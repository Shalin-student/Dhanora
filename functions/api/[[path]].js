import {
  computePlanExpiryIso,
  createGatewayCheckout,
  getPlanPriceMinor,
  resolvePromoDiscount,
  verifyRazorpayPaymentSignatureWeb,
  verifyRazorpayWebhookSignatureWeb,
  verifyStripeWebhookSignatureWeb,
} from '../../server/edge/billingCore.mjs';
import { createD1Store, ensureD1Schema } from '../../server/edge/d1Store.mjs';
import {
  buildFeedbackAlertEmail,
  buildInviteEmail,
  buildPasswordResetEmail,
  buildReceiptEmail,
  sendTransactionalEmail,
} from '../../server/edge/emailCore.mjs';

const SESSION_COOKIE_NAME = 'hl_session';
const rateBuckets = new Map();

function checkRateLimit(key, maxRequests = 60, windowMs = 60_000, disabled = false) {
  if (disabled) return true;
  const now = Date.now();
  if (rateBuckets.size > 1000) {
    for (const [k, b] of rateBuckets.entries()) {
      if (b.resetAt <= now) rateBuckets.delete(k);
    }
  }
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= maxRequests;
}

function parseCookies(request) {
  const header = request.headers.get('cookie');
  if (!header) return {};
  const map = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) map[key] = val;
  }
  return map;
}

function isHttpsRequest(request) {
  try {
    const proto = String(request.headers.get('x-forwarded-proto') || '').toLowerCase();
    return proto === 'https' || new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

function formatSessionCookie(request, token, maxAgeSeconds = 14 * 86400) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttpsRequest(request)) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function sanitizeStateForRole(state, role) {
  if (!state || typeof state !== 'object') return state;
  if (role !== 'advisor' && role !== 'dependent') return state;
  const { emergencyInfo: _strippedEmergency, settings, ...rest } = state;
  const cleanSettings = settings
    ? {
        ...settings,
        pinHash: undefined,
        pinSalt: undefined,
      }
    : settings;
  return {
    ...rest,
    settings: cleanSettings,
  };
}

function resolveRequestOrigin(request, env) {
  if (env.APP_BASE_URL && String(env.APP_BASE_URL).trim()) {
    return String(env.APP_BASE_URL).trim().replace(/\/+$/, '');
  }
  return new URL(request.url).origin.replace(/\/+$/, '');
}

function buildSecurityHeaders(request, env, extra = {}) {
  const origin = new URL(request.url).origin;
  const allowedOrigin = env.CORS_ALLOWED_ORIGINS || origin;
  const headers = new Headers({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Household-Sync-Key',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  });
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined) headers.set(k, v);
  }
  return headers;
}

function jsonResponse(request, env, statusCode, payload, extraHeaders = {}) {
  const headers = buildSecurityHeaders(request, env, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  return new Response(JSON.stringify(payload), { status: statusCode, headers });
}

async function readRawBodyLimited(request, maxBytes = 6 * 1024 * 1024) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) {
    throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
  }
  return text;
}

async function readJsonBody(request, maxBytes = 6 * 1024 * 1024) {
  const text = await readRawBodyLimited(request, maxBytes);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 });
  }
}

function extractSessionToken(request) {
  const authHeader = request.headers.get('authorization');
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(request);
  return cookies[SESSION_COOKIE_NAME] || '';
}

function allowSandboxBilling(env) {
  return env.ALLOW_TEST_BILLING === 'true';
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildSecurityHeaders(request, env) });
  }

  // On Cloudflare Edge, SSE returns 204 so EventSource stops without reconnect loops;
  // state stays consistent via debounced PUT /api/state and window focus sync.
  if (method === 'GET' && pathname === '/api/events') {
    return new Response(null, { status: 204, headers: buildSecurityHeaders(request, env) });
  }

  if (!env?.DB) {
    return jsonResponse(request, env, 503, {
      error: 'D1_NOT_CONFIGURED',
      message: 'Bind a Cloudflare D1 database named DB in Pages Settings -> Bindings.',
    });
  }

  await ensureD1Schema(env.DB);
  const store = createD1Store(env.DB);

  const clientIp = String(request.headers.get('cf-connecting-ip') || 'edge').trim();
  const disableRateLimit = env.DISABLE_RATE_LIMIT === 'true';
  const syncKey = env.HEARTHLEDGER_SYNC_KEY || '';
  const requireAuthForSync = env.REQUIRE_AUTH_FOR_SYNC !== 'false';
  const scheduleBg = async (promise) => {
    if (typeof context?.waitUntil === 'function') {
      context.waitUntil(promise);
    } else {
      await promise;
    }
  };

  async function resolveSession() {
    const token = extractSessionToken(request);
    if (!token) return null;
    const row = await store.getSessionByToken(token);
    if (!row) return null;
    return { ...row, token };
  }

  async function resolveDataTenant() {
    const session = await resolveSession();
    if (session) {
      return {
        ok: true,
        session,
        householdId: session.householdId,
        role: session.role,
      };
    }
    if (requireAuthForSync) {
      return { ok: false, statusCode: 401, error: 'AUTH_REQUIRED' };
    }
    if (syncKey) {
      const header = request.headers.get('x-household-sync-key');
      if (header !== syncKey) {
        return { ok: false, statusCode: 401, error: 'UNAUTHORIZED' };
      }
    }
    return { ok: true, session: null, householdId: 'default', role: 'admin' };
  }

  try {
    // 1. Webhooks (verify exact raw body BEFORE JSON.parse)
    if (method === 'POST' && pathname === '/api/webhooks/razorpay') {
      const rawBody = await readRawBodyLimited(request, 512 * 1024);
      const signature = request.headers.get('x-razorpay-signature');
      const secret = env.RAZORPAY_WEBHOOK_SECRET || '';
      const valid = await verifyRazorpayWebhookSignatureWeb({ rawBody, signature, secret });
      if (!valid) {
        return jsonResponse(request, env, 401, { error: 'INVALID_WEBHOOK_SIGNATURE' });
      }
      const event = JSON.parse(rawBody || '{}');
      const payment = event?.payload?.payment?.entity;
      const notes = payment?.notes || event?.payload?.order?.entity?.notes || {};
      const householdId = notes.householdId;
      const tier = notes.tier === 'advisor' ? 'advisor' : 'plus';
      const billingCycle = notes.billingCycle === 'monthly' ? 'monthly' : 'yearly';
      if (householdId && (event.event === 'payment.captured' || event.event === 'order.paid')) {
        const expiresAt = computePlanExpiryIso(billingCycle);
        await store.updateHouseholdBilling(householdId, {
          planTier: tier,
          planStatus: 'active',
          billingCycle,
          planExpiresAt: expiresAt,
          billingProvider: 'razorpay',
        });
        await store.recordInvoice({
          householdId,
          provider: 'razorpay',
          providerPaymentId: payment?.id,
          providerOrderId: payment?.order_id,
          planTier: tier,
          billingCycle,
          currency: payment?.currency || 'INR',
          amountMinor: Number(payment?.amount || 0),
          gstNumber: notes.gstNumber || null,
          status: 'paid',
        });
      }
      return jsonResponse(request, env, 200, { ok: true });
    }

    if (method === 'POST' && pathname === '/api/webhooks/stripe') {
      const rawBody = await readRawBodyLimited(request, 512 * 1024);
      const sigHeader = request.headers.get('stripe-signature');
      const secret = env.STRIPE_WEBHOOK_SECRET || '';
      const valid = await verifyStripeWebhookSignatureWeb({
        rawBody,
        signatureHeader: sigHeader,
        secret,
      });
      if (!valid) {
        return jsonResponse(request, env, 401, { error: 'INVALID_WEBHOOK_SIGNATURE' });
      }
      const event = JSON.parse(rawBody || '{}');
      const obj = event?.data?.object || {};
      const householdId = obj.client_reference_id || obj.metadata?.householdId;
      const tier = obj.metadata?.tier === 'advisor' ? 'advisor' : 'plus';
      const billingCycle = obj.metadata?.billingCycle === 'monthly' ? 'monthly' : 'yearly';

      if (householdId && event.type === 'checkout.session.completed') {
        const expiresAt = computePlanExpiryIso(billingCycle);
        await store.updateHouseholdBilling(householdId, {
          planTier: tier,
          planStatus: 'active',
          billingCycle,
          planExpiresAt: expiresAt,
          billingProvider: 'stripe',
        });
        await store.recordInvoice({
          householdId,
          provider: 'stripe',
          providerPaymentId: obj.payment_intent || obj.id,
          providerOrderId: obj.id,
          planTier: tier,
          billingCycle,
          currency: String(obj.currency || 'USD').toUpperCase(),
          amountMinor: Number(obj.amount_total || 0),
          status: 'paid',
        });
      } else if (householdId && event.type === 'customer.subscription.deleted') {
        await store.updateHouseholdBilling(householdId, {
          planTier: 'free',
          planStatus: 'canceled',
        });
      }
      return jsonResponse(request, env, 200, { ok: true });
    }

    // 2. Health
    if (method === 'GET' && pathname === '/api/health') {
      const session = await resolveSession();
      if (!session && syncKey && request.headers.get('x-household-sync-key') !== syncKey) {
        return jsonResponse(request, env, 401, { error: 'UNAUTHORIZED' });
      }
      const hhId = session?.householdId || 'default';
      const snap = await store.getSnapshot(hhId);
      return jsonResponse(request, env, 200, {
        ok: true,
        engine: 'd1',
        revision: snap.revision,
        updatedAt: snap.updatedAt,
        authenticated: Boolean(session),
        authRequired: requireAuthForSync,
      });
    }

    // 3. Public Invite Lookup
    if (method === 'GET' && pathname.startsWith('/api/invites/')) {
      const code = decodeURIComponent(pathname.slice('/api/invites/'.length));
      const inv = await store.getInviteByCode(code);
      if (!inv || !inv.valid) {
        return jsonResponse(request, env, 404, { error: 'INVITE_INVALID_OR_EXPIRED' });
      }
      return jsonResponse(request, env, 200, {
        ok: true,
        invite: {
          code: inv.code,
          householdName: inv.householdName,
          role: inv.role,
          invitedEmail: inv.invitedEmail,
          expiresAt: inv.expiresAt,
        },
      });
    }

    // 4. Auth Routes
    if (method === 'POST' && pathname === '/api/auth/signup') {
      if (!checkRateLimit(`signup:${clientIp}`, 25, 60_000, disableRateLimit)) {
        return jsonResponse(request, env, 429, { error: 'RATE_LIMITED' });
      }
      const body = await readJsonBody(request, 64 * 1024);
      const email = String(body?.email ?? '').trim().toLowerCase();
      const name = String(body?.name ?? '').trim();
      const password = String(body?.password ?? '');
      const role = ['admin', 'partner', 'dependent', 'advisor'].includes(body?.role)
        ? body.role
        : 'admin';
      if (!name || !email.includes('@') || password.length < 6) {
        return jsonResponse(request, env, 400, { error: 'INVALID_SIGNUP_FIELDS' });
      }
      const created = await store.createUser({
        name,
        email,
        password,
        role,
        memberId: String(body?.memberId ?? `m-${Date.now()}`),
        avatar: String(body?.avatar ?? '🧑🏽‍💻'),
        householdName: body?.householdName,
        planTier: 'free',
        inviteCode: body?.inviteCode,
      });
      if (created.invalidInvite) {
        return jsonResponse(request, env, 400, { error: 'INVITE_INVALID_OR_EXPIRED' });
      }
      if (created.exists) {
        return jsonResponse(request, env, 409, { error: 'EMAIL_EXISTS' });
      }
      return jsonResponse(
        request,
        env,
        200,
        { ok: true, session: created.session },
        { 'Set-Cookie': formatSessionCookie(request, created.session.token) }
      );
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      if (!checkRateLimit(`login:${clientIp}`, 35, 60_000, disableRateLimit)) {
        return jsonResponse(request, env, 429, { error: 'RATE_LIMITED' });
      }
      const body = await readJsonBody(request, 64 * 1024);
      const email = String(body?.email ?? '').trim().toLowerCase();
      const password = String(body?.password ?? '');
      const verified = await store.verifyUserLogin(email, password);
      if (!verified) {
        return jsonResponse(request, env, 401, { error: 'INVALID_CREDENTIALS' });
      }
      return jsonResponse(
        request,
        env,
        200,
        { ok: true, session: verified },
        { 'Set-Cookie': formatSessionCookie(request, verified.token) }
      );
    }

    if (method === 'GET' && pathname === '/api/auth/me') {
      const session = await resolveSession();
      if (!session) {
        return jsonResponse(request, env, 200, { authenticated: false, session: null });
      }
      return jsonResponse(request, env, 200, {
        authenticated: true,
        session: {
          token: session.token,
          userId: session.userId,
          householdId: session.householdId,
          householdName: session.householdName,
          name: session.name,
          email: session.email,
          role: session.role,
          memberId: session.memberId,
          avatar: session.avatar,
          planTier: session.planTier,
          planStatus: session.planStatus,
          trialEndsAt: session.trialEndsAt ?? undefined,
          planExpiresAt: session.planExpiresAt ?? undefined,
          isDemo: false,
        },
      });
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      const token = extractSessionToken(request);
      if (token) await store.deleteSessionByToken(token);
      return jsonResponse(
        request,
        env,
        200,
        { ok: true },
        { 'Set-Cookie': formatSessionCookie(request, '', 0) }
      );
    }

    if (method === 'POST' && pathname === '/api/auth/change-password') {
      const session = await resolveSession();
      if (!session) {
        return jsonResponse(request, env, 401, { error: 'AUTH_REQUIRED' });
      }
      const body = await readJsonBody(request, 16 * 1024);
      const curPw = String(body?.currentPassword ?? '');
      const nextPw = String(body?.newPassword ?? '');
      if (nextPw.length < 6) {
        return jsonResponse(request, env, 400, { error: 'PASSWORD_TOO_SHORT' });
      }
      const resPw = await store.rotateUserPassword(session.userId, curPw, nextPw);
      if (!resPw.ok) {
        return jsonResponse(request, env, 401, { error: resPw.error });
      }
      const { token } = await store.createSession({
        userId: session.userId,
        householdId: session.householdId,
        role: session.role,
      });
      return jsonResponse(
        request,
        env,
        200,
        { ok: true },
        { 'Set-Cookie': formatSessionCookie(request, token) }
      );
    }

    if (method === 'POST' && pathname === '/api/auth/forgot-password') {
      if (!checkRateLimit(`forgot:${clientIp}`, 10, 60_000, disableRateLimit)) {
        return jsonResponse(request, env, 429, { error: 'RATE_LIMITED' });
      }
      const body = await readJsonBody(request, 16 * 1024);
      const email = String(body?.email ?? '').trim().toLowerCase();
      if (!email.includes('@')) {
        return jsonResponse(request, env, 400, { error: 'INVALID_EMAIL' });
      }
      const createdReset = await store.createPasswordResetToken(email, 30);
      let delivery = env.RESEND_API_KEY ? 'email_queued' : 'email_not_configured';
      if (createdReset && env.RESEND_API_KEY) {
        const origin = resolveRequestOrigin(request, env);
        const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(createdReset.token)}`;
        const mail = buildPasswordResetEmail({ name: createdReset.name, resetUrl });
        await scheduleBg(
          sendTransactionalEmail({
            to: createdReset.email,
            subject: mail.subject,
            html: mail.html,
            env,
          })
        );
      }
      return jsonResponse(request, env, 200, { ok: true, delivery });
    }

    if (method === 'POST' && pathname === '/api/auth/reset-password') {
      if (!checkRateLimit(`reset:${clientIp}`, 15, 60_000, disableRateLimit)) {
        return jsonResponse(request, env, 429, { error: 'RATE_LIMITED' });
      }
      const body = await readJsonBody(request, 16 * 1024);
      const token = String(body?.token ?? '').trim();
      const newPassword = String(body?.newPassword ?? '');
      if (newPassword.length < 6) {
        return jsonResponse(request, env, 400, { error: 'PASSWORD_TOO_SHORT' });
      }
      const resReset = await store.consumePasswordResetToken({ token, newPassword });
      if (!resReset.ok) {
        return jsonResponse(request, env, 400, { error: resReset.error });
      }
      return jsonResponse(request, env, 200, { ok: true });
    }

    if (method === 'DELETE' && pathname === '/api/account') {
      const session = await resolveSession();
      if (!session) {
        return jsonResponse(request, env, 401, { error: 'AUTH_REQUIRED' });
      }
      if (session.role !== 'admin') {
        return jsonResponse(request, env, 403, { error: 'ADMIN_ONLY_DELETE_HOUSEHOLD' });
      }
      await store.deleteHouseholdCascade(session.householdId);
      return jsonResponse(
        request,
        env,
        200,
        { ok: true },
        { 'Set-Cookie': formatSessionCookie(request, '', 0) }
      );
    }

    // 5. Invites Management (Admin)
    if (pathname === '/api/invites') {
      const session = await resolveSession();
      if (!session) {
        return jsonResponse(request, env, 401, { error: 'AUTH_REQUIRED' });
      }
      if (session.role !== 'admin') {
        return jsonResponse(request, env, 403, { error: 'ADMIN_ONLY' });
      }
      if (method === 'GET') {
        return jsonResponse(request, env, 200, {
          invites: await store.listInvites(session.householdId),
        });
      }
      if (method === 'POST') {
        const body = await readJsonBody(request, 16 * 1024);
        const inv = await store.createInvite({
          householdId: session.householdId,
          role: body?.role,
          invitedEmail: body?.email,
          createdByUserId: session.userId,
        });
        const origin = resolveRequestOrigin(request, env);
        const inviteUrl = `${origin}/invite?code=${encodeURIComponent(inv.code)}`;
        if (inv.invitedEmail && env.RESEND_API_KEY) {
          const mail = buildInviteEmail({
            householdName: session.householdName,
            role: inv.role,
            inviteUrl,
          });
          await scheduleBg(
            sendTransactionalEmail({
              to: inv.invitedEmail,
              subject: mail.subject,
              html: mail.html,
              env,
            })
          );
        }
        return jsonResponse(request, env, 200, {
          ok: true,
          invite: inv,
          inviteUrl,
        });
      }
    }

    // 5b. In-App Support & User Feedback
    if (pathname === '/api/feedback') {
      const session = await resolveSession();
      if (method === 'GET') {
        if (!session) return jsonResponse(request, env, 401, { error: 'AUTH_REQUIRED' });
        return jsonResponse(request, env, 200, {
          feedback: await store.listFeedback(session.householdId),
        });
      }
      if (method === 'POST') {
        if (!checkRateLimit(`feedback:${clientIp}`, 15, 60_000, disableRateLimit)) {
          return jsonResponse(request, env, 429, { error: 'RATE_LIMITED' });
        }
        const body = await readJsonBody(request, 32 * 1024);
        const message = String(body?.message ?? '').trim();
        if (message.length < 4) {
          return jsonResponse(request, env, 400, { error: 'FEEDBACK_TOO_SHORT' });
        }
        const category = String(body?.category ?? 'general').trim();
        const userEmail = session?.email || (body?.email ? String(body.email).trim() : null);
        const userName = session?.name || (body?.name ? String(body.name).trim() : 'Guest User');
        const saved = await store.saveFeedback({
          householdId: session?.householdId ?? null,
          userId: session?.userId ?? null,
          userEmail,
          userName,
          category,
          message,
          pageView: body?.pageView ? String(body.pageView) : null,
        });
        const alertTo = env.SUPPORT_ALERT_EMAIL || 'shalinpatel1102@gmail.com';
        if (env.RESEND_API_KEY) {
          const mail = buildFeedbackAlertEmail({
            userName,
            userEmail,
            category,
            message,
            pageView: body?.pageView,
          });
          await scheduleBg(
            sendTransactionalEmail({
              to: alertTo,
              replyTo: userEmail || undefined,
              subject: mail.subject,
              html: mail.html,
              env,
            })
          );
        }
        return jsonResponse(request, env, 200, { ok: true, id: saved.id });
      }
    }

    // 6. Billing & Subscriptions
    if (pathname.startsWith('/api/billing/')) {
      const session = await resolveSession();
      if (!session) {
        return jsonResponse(request, env, 401, { error: 'AUTH_REQUIRED' });
      }
      if (!checkRateLimit(`billing:${session.householdId}`, 30, 60_000, disableRateLimit)) {
        return jsonResponse(request, env, 429, { error: 'RATE_LIMITED' });
      }
      if (session.role === 'dependent') {
        return jsonResponse(request, env, 403, { error: 'BILLING_RESTRICTED' });
      }

      if (method === 'GET' && pathname === '/api/billing/invoices') {
        return jsonResponse(request, env, 200, {
          household: await store.getHousehold(session.householdId),
          invoices: await store.listInvoices(session.householdId),
        });
      }

      if (method === 'POST' && pathname === '/api/billing/trial') {
        const hh = await store.getHousehold(session.householdId);
        if (hh?.trialEndsAt) {
          return jsonResponse(request, env, 409, { error: 'TRIAL_ALREADY_USED' });
        }
        const trialEndsAt = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        const updated = await store.updateHouseholdBilling(session.householdId, {
          planTier: 'plus',
          planStatus: 'trialing',
          trialEndsAt,
        });
        return jsonResponse(request, env, 200, { ok: true, household: updated });
      }

      if (method === 'POST' && pathname === '/api/billing/validate-promo') {
        const body = await readJsonBody(request, 16 * 1024);
        const tier = body?.tier === 'advisor' ? 'advisor' : 'plus';
        const billingCycle = body?.billingCycle === 'monthly' ? 'monthly' : 'yearly';
        const currency = body?.currency === 'USD' ? 'USD' : 'INR';
        const pricing = getPlanPriceMinor(tier, currency, billingCycle);
        if (!pricing) {
          return jsonResponse(request, env, 400, { error: 'INVALID_PLAN_TIER' });
        }
        const promo = resolvePromoDiscount({
          promoCode: body?.promoCode,
          amountMinor: pricing.amountMinor,
          currency: pricing.currency,
          env,
        });
        if (!promo.valid) {
          return jsonResponse(request, env, 404, { error: 'INVALID_PROMO_CODE' });
        }
        return jsonResponse(request, env, 200, { ok: true, promo });
      }

      if (method === 'POST' && pathname === '/api/billing/checkout') {
        const body = await readJsonBody(request, 32 * 1024);
        const tier = body?.tier === 'advisor' ? 'advisor' : 'plus';
        const billingCycle = body?.billingCycle === 'monthly' ? 'monthly' : 'yearly';
        const currency = body?.currency === 'USD' ? 'USD' : 'INR';
        const origin = resolveRequestOrigin(request, env);
        const checkout = await createGatewayCheckout({
          householdId: session.householdId,
          userEmail: session.email,
          tier,
          billingCycle,
          currency,
          gstNumber: body?.gstNumber ? String(body.gstNumber).trim() : '',
          promoCode: body?.promoCode ? String(body.promoCode).trim() : '',
          baseUrl: origin,
          env: { NODE_ENV: 'production', ...env },
        });
        if (checkout.orderId) {
          await store.savePendingOrder({
            orderId: checkout.orderId,
            householdId: session.householdId,
            provider: checkout.provider,
            planTier: checkout.tier,
            billingCycle: checkout.billingCycle,
            currency: checkout.currency,
            amountMinor: checkout.amountMinor,
          });
        }
        return jsonResponse(request, env, 200, { ok: true, checkout });
      }

      if (method === 'POST' && pathname === '/api/billing/razorpay/verify') {
        const body = await readJsonBody(request, 32 * 1024);
        const orderId = String(body?.razorpay_order_id ?? '');
        const paymentId = String(body?.razorpay_payment_id ?? '');
        const signature = String(body?.razorpay_signature ?? '');
        const secret = env.RAZORPAY_KEY_SECRET || '';
        const valid = await verifyRazorpayPaymentSignatureWeb({
          orderId,
          paymentId,
          signature,
          secret,
        });
        if (!valid) {
          return jsonResponse(request, env, 401, { error: 'INVALID_PAYMENT_SIGNATURE' });
        }
        const pendingOrder = await store.getPendingOrder(orderId);
        if (pendingOrder && pendingOrder.householdId !== session.householdId) {
          return jsonResponse(request, env, 403, { error: 'ORDER_HOUSEHOLD_MISMATCH' });
        }
        if (!pendingOrder && env.NODE_ENV !== 'test' && env.ALLOW_TEST_BILLING !== 'true') {
          return jsonResponse(request, env, 404, { error: 'ORDER_NOT_FOUND' });
        }
        const tier = pendingOrder
          ? pendingOrder.planTier
          : body?.tier === 'advisor'
            ? 'advisor'
            : 'plus';
        const billingCycle = pendingOrder
          ? pendingOrder.billingCycle
          : body?.billingCycle === 'monthly'
            ? 'monthly'
            : 'yearly';
        const price = getPlanPriceMinor(tier, 'INR', billingCycle);
        const expiresAt = computePlanExpiryIso(billingCycle);
        const updated = await store.updateHouseholdBilling(session.householdId, {
          planTier: tier,
          planStatus: 'active',
          billingCycle,
          planExpiresAt: expiresAt,
          billingProvider: 'razorpay',
        });
        await store.recordInvoice({
          householdId: session.householdId,
          provider: 'razorpay',
          providerPaymentId: paymentId,
          providerOrderId: orderId,
          planTier: tier,
          billingCycle,
          currency: 'INR',
          amountMinor: pendingOrder?.amountMinor ?? price?.amountMinor ?? 100,
          gstNumber: body?.gstNumber ? String(body.gstNumber).trim() : null,
          status: 'paid',
        });
        if (env.RESEND_API_KEY && session.email) {
          const paidMinor = pendingOrder?.amountMinor ?? price?.amountMinor ?? 100;
          const mail = buildReceiptEmail({
            householdName: session.householdName,
            planName: tier === 'advisor' ? 'Advisor Practice' : 'Family Plus',
            billingCycle,
            amountDisplay: `₹${(paidMinor / 100).toFixed(2).replace(/\.00$/, '')}`,
            paymentId,
          });
          await scheduleBg(
            sendTransactionalEmail({
              to: session.email,
              subject: mail.subject,
              html: mail.html,
              env,
            })
          );
        }
        return jsonResponse(request, env, 200, { ok: true, household: updated });
      }

      if (method === 'POST' && pathname === '/api/billing/sandbox/complete') {
        if (!allowSandboxBilling(env)) {
          return jsonResponse(request, env, 403, { error: 'SANDBOX_BILLING_DISABLED' });
        }
        const body = await readJsonBody(request, 32 * 1024);
        const tier = body?.tier === 'advisor' ? 'advisor' : 'plus';
        const billingCycle = body?.billingCycle === 'monthly' ? 'monthly' : 'yearly';
        const currency = body?.currency === 'USD' ? 'USD' : 'INR';
        const price = getPlanPriceMinor(tier, currency, billingCycle);
        const expiresAt = computePlanExpiryIso(billingCycle);
        const updated = await store.updateHouseholdBilling(session.householdId, {
          planTier: tier,
          planStatus: 'active',
          billingCycle,
          planExpiresAt: expiresAt,
          billingProvider: currency === 'INR' ? 'razorpay' : 'stripe',
        });
        await store.recordInvoice({
          householdId: session.householdId,
          provider: currency === 'INR' ? 'razorpay-sandbox' : 'stripe-sandbox',
          providerPaymentId: `pay_sandbox_${Date.now()}`,
          providerOrderId: body?.orderId ? String(body.orderId) : `ord_sandbox_${Date.now()}`,
          planTier: tier,
          billingCycle,
          currency,
          amountMinor: price?.amountMinor ?? 100,
          gstNumber: body?.gstNumber ? String(body.gstNumber).trim() : null,
          status: 'sandbox_paid',
        });
        return jsonResponse(request, env, 200, { ok: true, household: updated });
      }
    }

    // 7. Tenant-Scoped Data Sync & Receipts
    const tenant = await resolveDataTenant();
    if (!tenant.ok) {
      return jsonResponse(request, env, tenant.statusCode, { error: tenant.error });
    }
    const { householdId, role, session } = tenant;

    if (method === 'GET' && pathname === '/api/state') {
      const snap = await store.getSnapshot(householdId);
      return jsonResponse(request, env, 200, {
        ...snap,
        state: sanitizeStateForRole(snap.state, role),
      });
    }

    if (method === 'PUT' && pathname === '/api/state') {
      const body = await readJsonBody(request, 4 * 1024 * 1024);
      if (!body || !body.state || !Array.isArray(body.state.transactions)) {
        return jsonResponse(request, env, 400, { error: 'INVALID_STATE_PAYLOAD' });
      }

      let nextState = body.state;
      if (session && (role === 'advisor' || role === 'dependent')) {
        const existing = (await store.getSnapshot(householdId))?.state;
        if (existing) {
          nextState = {
            ...nextState,
            emergencyInfo: existing.emergencyInfo,
            members: existing.members,
            settings: {
              ...nextState.settings,
              pinEnabled: existing.settings?.pinEnabled ?? false,
              pinHash: existing.settings?.pinHash,
              pinSalt: existing.settings?.pinSalt,
            },
          };
        }
      }

      const result = await store.updateSnapshot({
        householdId,
        baseRevision: Number(body.baseRevision ?? 0),
        state: nextState,
        actor: body.actor,
        auditEntry: body.auditEntry,
        force: Boolean(body.force),
      });

      if (result.conflict) {
        return jsonResponse(request, env, 409, {
          error: 'SYNC_CONFLICT',
          serverRevision: result.snapshot.revision,
          serverState: sanitizeStateForRole(result.snapshot.state, role),
          updatedAt: result.snapshot.updatedAt,
          activity: result.snapshot.activity,
        });
      }

      return jsonResponse(request, env, 200, {
        revision: result.revision,
        updatedAt: result.updatedAt,
        activity: result.activity,
      });
    }

    if (method === 'GET' && pathname === '/api/receipts') {
      return jsonResponse(request, env, 200, {
        receipts: await store.listReceiptsMeta(householdId),
      });
    }

    if (pathname.startsWith('/api/receipts/')) {
      const id = decodeURIComponent(pathname.slice('/api/receipts/'.length));
      if (!id) {
        return jsonResponse(request, env, 400, { error: 'MISSING_RECEIPT_ID' });
      }
      if (method === 'GET') {
        const rec = await store.getReceipt(id, householdId);
        if (!rec) {
          return jsonResponse(request, env, 404, { error: 'NOT_FOUND' });
        }
        return jsonResponse(request, env, 200, rec);
      }
      if (method === 'PUT') {
        const body = await readJsonBody(request, 2 * 1024 * 1024);
        if (!body || typeof body.dataUrl !== 'string') {
          return jsonResponse(request, env, 400, { error: 'INVALID_RECEIPT_PAYLOAD' });
        }
        await store.saveReceipt(
          {
            id,
            txId: String(body.txId ?? ''),
            fileName: String(body.fileName ?? 'receipt.png'),
            mimeType: String(body.mimeType ?? 'image/png'),
            sizeBytes: Number(body.sizeBytes ?? 0),
            dataUrl: body.dataUrl,
            createdAt: body.createdAt,
          },
          householdId
        );
        return jsonResponse(request, env, 200, { ok: true, id });
      }
      if (method === 'DELETE') {
        await store.deleteReceipt(id, householdId);
        return jsonResponse(request, env, 200, { ok: true, id });
      }
    }

    return jsonResponse(request, env, 404, { error: 'API_ROUTE_NOT_FOUND' });
  } catch (err) {
    const status = err?.statusCode || 500;
    return jsonResponse(request, env, status, { error: err?.message || 'INTERNAL_SERVER_ERROR' });
  }
}
