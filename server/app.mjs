import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createSyncDatabase } from './db.mjs';
import {
  computePlanExpiryIso,
  createGatewayCheckout,
  getPlanPriceMinor,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
  verifyStripeWebhookSignature,
} from './billing.mjs';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const SESSION_COOKIE_NAME = 'hl_session';

const PUBLIC_SITEMAP_PATHS = [
  '/',
  '/pricing',
  '/calculators',
  '/signin',
  '/signup',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/contact',
];

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function readRawBody(req, maxBytes = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

async function readJsonBody(req, maxBytes = 12 * 1024 * 1024) {
  const text = await readRawBody(req, maxBytes);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 });
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
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

function isHttpsRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || Boolean(req.socket?.encrypted);
}

function formatSessionCookie(req, token, maxAgeSeconds = 14 * 86400) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttpsRequest(req)) {
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

function resolveRequestOrigin(req, configuredBaseUrl) {
  if (configuredBaseUrl && String(configuredBaseUrl).trim()) {
    return String(configuredBaseUrl).trim().replace(/\/+$/, '');
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:4174';
  const proto = isHttpsRequest(req) ? 'https' : 'http';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function escapeHtmlAttr(val) {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createSyncServer(options = {}) {
  const env = options.env ?? process.env;
  const dbPath =
    options.dbPath ?? path.resolve(process.cwd(), 'data', 'hearthledger.db');
  const distDir = options.distDir ?? path.resolve(process.cwd(), 'dist');
  const syncKey = options.syncKey ?? env.HEARTHLEDGER_SYNC_KEY ?? '';
  const requireAuthForSync =
    options.requireAuthForSync ?? env.REQUIRE_AUTH_FOR_SYNC === 'true';
  const configuredBaseUrl = options.appBaseUrl ?? env.APP_BASE_URL ?? '';
  const googleSiteVerification =
    options.googleSiteVerification ?? env.GOOGLE_SITE_VERIFICATION ?? '';

  const store = createSyncDatabase(dbPath);
  // Map<householdId, Set<http.ServerResponse>>
  const sseChannels = new Map();
  // Map<rateKey, { count: number, resetAt: number }>
  const rateBuckets = new Map();

  function checkRateLimit(key, maxRequests = 60, windowMs = 60_000) {
    if (options.disableRateLimit) return true;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= maxRequests;
  }

  function broadcastEvent(householdId, eventName, data) {
    const key = householdId || 'default';
    const clients = sseChannels.get(key);
    if (!clients || clients.size === 0) return;
    const frame = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try {
        client.write(frame);
      } catch {
        clients.delete(client);
      }
    }
  }

  function extractSessionToken(req) {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }
    const cookies = parseCookies(req);
    return cookies[SESSION_COOKIE_NAME] || '';
  }

  function resolveSession(req) {
    const token = extractSessionToken(req);
    if (!token) return null;
    const row = store.getSessionByToken(token);
    if (!row) return null;
    return { ...row, token };
  }

  function resolveDataTenant(req) {
    const session = resolveSession(req);
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

    // Legacy / LAN sync-key path for single-household headless sync & tests
    if (syncKey) {
      const header = req.headers['x-household-sync-key'];
      if (header !== syncKey) {
        return { ok: false, statusCode: 401, error: 'UNAUTHORIZED' };
      }
    }
    return { ok: true, session: null, householdId: 'default', role: 'admin' };
  }

  function allowSandboxBilling() {
    return (
      env.ALLOW_TEST_BILLING === 'true' ||
      (env.NODE_ENV !== 'production' && env.ALLOW_TEST_BILLING !== 'false')
    );
  }

  function applySecurityHeaders(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' https://checkout.razorpay.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
        "frame-src https://api.razorpay.com https://checkout.stripe.com",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; ')
    );
    if (isHttpsRequest(req)) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    const clientIp = String(
      req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local'
    ).split(',')[0].trim();

    applySecurityHeaders(req, res);

    // Tight CORS support (same-origin by default unless CORS_ALLOWED_ORIGINS specified)
    const allowedCors = env.CORS_ALLOWED_ORIGINS || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedCors);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Household-Sync-Key'
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Dynamic robots.txt & sitemap.xml so Search Console gets live domain canonicals
    if (req.method === 'GET' && pathname === '/robots.txt') {
      const origin = resolveRequestOrigin(req, configuredBaseUrl);
      const robots = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`;
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(robots);
      return;
    }

    if (req.method === 'GET' && pathname === '/sitemap.xml') {
      const origin = resolveRequestOrigin(req, configuredBaseUrl);
      const today = new Date().toISOString().slice(0, 10);
      const urlNodes = PUBLIC_SITEMAP_PATHS.map((p) => {
        const prio = p === '/' ? '1.0' : p === '/pricing' || p === '/calculators' ? '0.9' : '0.6';
        return `  <url>\n    <loc>${escapeHtmlAttr(origin + p)}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${prio}</priority>\n  </url>`;
      }).join('\n');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlNodes}\n</urlset>\n`;
      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(xml);
      return;
    }

    // Webhooks must read exact raw body BEFORE JSON parsing to verify HMAC signatures
    if (req.method === 'POST' && pathname === '/api/webhooks/razorpay') {
      try {
        const rawBody = await readRawBody(req, 512 * 1024);
        const signature = req.headers['x-razorpay-signature'];
        const secret = env.RAZORPAY_WEBHOOK_SECRET || '';
        if (!verifyRazorpayWebhookSignature({ rawBody, signature, secret })) {
          sendJson(res, 401, { error: 'INVALID_WEBHOOK_SIGNATURE' });
          return;
        }
        const event = JSON.parse(rawBody || '{}');
        const payment = event?.payload?.payment?.entity;
        const notes = payment?.notes || event?.payload?.order?.entity?.notes || {};
        const householdId = notes.householdId;
        const tier = notes.tier === 'advisor' ? 'advisor' : 'plus';
        const billingCycle = notes.billingCycle === 'monthly' ? 'monthly' : 'yearly';
        if (householdId && (event.event === 'payment.captured' || event.event === 'order.paid')) {
          const expiresAt = computePlanExpiryIso(billingCycle);
          store.updateHouseholdBilling(householdId, {
            planTier: tier,
            planStatus: 'active',
            billingCycle,
            planExpiresAt: expiresAt,
            billingProvider: 'razorpay',
          });
          store.recordInvoice({
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
          broadcastEvent(householdId, 'billing_updated', { planTier: tier });
        }
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, err?.statusCode || 400, { error: err?.message || 'WEBHOOK_ERROR' });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/api/webhooks/stripe') {
      try {
        const rawBody = await readRawBody(req, 512 * 1024);
        const sigHeader = req.headers['stripe-signature'];
        const secret = env.STRIPE_WEBHOOK_SECRET || '';
        if (!verifyStripeWebhookSignature({ rawBody, signatureHeader: sigHeader, secret })) {
          sendJson(res, 401, { error: 'INVALID_WEBHOOK_SIGNATURE' });
          return;
        }
        const event = JSON.parse(rawBody || '{}');
        const obj = event?.data?.object || {};
        const householdId = obj.client_reference_id || obj.metadata?.householdId;
        const tier = obj.metadata?.tier === 'advisor' ? 'advisor' : 'plus';
        const billingCycle = obj.metadata?.billingCycle === 'monthly' ? 'monthly' : 'yearly';

        if (householdId && event.type === 'checkout.session.completed') {
          const expiresAt = computePlanExpiryIso(billingCycle);
          store.updateHouseholdBilling(householdId, {
            planTier: tier,
            planStatus: 'active',
            billingCycle,
            planExpiresAt: expiresAt,
            billingProvider: 'stripe',
          });
          store.recordInvoice({
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
          broadcastEvent(householdId, 'billing_updated', { planTier: tier });
        } else if (householdId && event.type === 'customer.subscription.deleted') {
          store.updateHouseholdBilling(householdId, {
            planTier: 'free',
            planStatus: 'canceled',
          });
        }
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, err?.statusCode || 400, { error: err?.message || 'WEBHOOK_ERROR' });
      }
      return;
    }

    if (pathname.startsWith('/api/')) {
      try {
        if (req.method === 'GET' && pathname === '/api/health') {
          const session = resolveSession(req);
          if (!session && syncKey && req.headers['x-household-sync-key'] !== syncKey) {
            sendJson(res, 401, { error: 'UNAUTHORIZED' });
            return;
          }
          const hhId = session?.householdId || 'default';
          const snap = store.getSnapshot(hhId);
          sendJson(res, 200, {
            ok: true,
            engine: 'sqlite',
            revision: snap.revision,
            updatedAt: snap.updatedAt,
            authenticated: Boolean(session),
            authRequired: requireAuthForSync,
          });
          return;
        }

        // Public invite inspection before signup
        if (req.method === 'GET' && pathname.startsWith('/api/invites/')) {
          const code = decodeURIComponent(pathname.slice('/api/invites/'.length));
          const inv = store.getInviteByCode(code);
          if (!inv || !inv.valid) {
            sendJson(res, 404, { error: 'INVITE_INVALID_OR_EXPIRED' });
            return;
          }
          sendJson(res, 200, {
            ok: true,
            invite: {
              code: inv.code,
              householdName: inv.householdName,
              role: inv.role,
              invitedEmail: inv.invitedEmail,
              expiresAt: inv.expiresAt,
            },
          });
          return;
        }

        // Auth Routes
        if (req.method === 'POST' && pathname === '/api/auth/signup') {
          if (!checkRateLimit(`signup:${clientIp}`, 25, 60_000)) {
            sendJson(res, 429, { error: 'RATE_LIMITED' });
            return;
          }
          const body = await readJsonBody(req, 64 * 1024);
          const email = String(body?.email ?? '').trim().toLowerCase();
          const name = String(body?.name ?? '').trim();
          const password = String(body?.password ?? '');
          const role = ['admin', 'partner', 'dependent', 'advisor'].includes(body?.role)
            ? body.role
            : 'admin';
          if (!name || !email.includes('@') || password.length < 6) {
            sendJson(res, 400, { error: 'INVALID_SIGNUP_FIELDS' });
            return;
          }
          const created = store.createUser({
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
            sendJson(res, 400, { error: 'INVITE_INVALID_OR_EXPIRED' });
            return;
          }
          if (created.exists) {
            sendJson(res, 409, { error: 'EMAIL_EXISTS' });
            return;
          }
          sendJson(
            res,
            200,
            { ok: true, session: created.session },
            { 'Set-Cookie': formatSessionCookie(req, created.session.token) }
          );
          return;
        }

        if (req.method === 'POST' && pathname === '/api/auth/login') {
          if (!checkRateLimit(`login:${clientIp}`, 35, 60_000)) {
            sendJson(res, 429, { error: 'RATE_LIMITED' });
            return;
          }
          const body = await readJsonBody(req, 64 * 1024);
          const email = String(body?.email ?? '').trim().toLowerCase();
          const password = String(body?.password ?? '');
          const verified = store.verifyUserLogin(email, password);
          if (!verified) {
            sendJson(res, 401, { error: 'INVALID_CREDENTIALS' });
            return;
          }
          sendJson(
            res,
            200,
            { ok: true, session: verified },
            { 'Set-Cookie': formatSessionCookie(req, verified.token) }
          );
          return;
        }

        if (req.method === 'GET' && pathname === '/api/auth/me') {
          const session = resolveSession(req);
          if (!session) {
            sendJson(res, 200, { authenticated: false, session: null });
            return;
          }
          sendJson(res, 200, {
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
          return;
        }

        if (req.method === 'POST' && pathname === '/api/auth/logout') {
          const token = extractSessionToken(req);
          if (token) store.deleteSessionByToken(token);
          sendJson(
            res,
            200,
            { ok: true },
            { 'Set-Cookie': formatSessionCookie(req, '', 0) }
          );
          return;
        }

        if (req.method === 'POST' && pathname === '/api/auth/change-password') {
          const session = resolveSession(req);
          if (!session) {
            sendJson(res, 401, { error: 'AUTH_REQUIRED' });
            return;
          }
          const body = await readJsonBody(req, 16 * 1024);
          const curPw = String(body?.currentPassword ?? '');
          const nextPw = String(body?.newPassword ?? '');
          if (nextPw.length < 6) {
            sendJson(res, 400, { error: 'PASSWORD_TOO_SHORT' });
            return;
          }
          const resPw = store.rotateUserPassword(session.userId, curPw, nextPw);
          if (!resPw.ok) {
            sendJson(res, 401, { error: resPw.error });
            return;
          }
          const { token } = store.createSession({
            userId: session.userId,
            householdId: session.householdId,
            role: session.role,
          });
          sendJson(
            res,
            200,
            { ok: true },
            { 'Set-Cookie': formatSessionCookie(req, token) }
          );
          return;
        }

        if (req.method === 'DELETE' && pathname === '/api/account') {
          const session = resolveSession(req);
          if (!session) {
            sendJson(res, 401, { error: 'AUTH_REQUIRED' });
            return;
          }
          if (session.role !== 'admin') {
            sendJson(res, 403, { error: 'ADMIN_ONLY_DELETE_HOUSEHOLD' });
            return;
          }
          store.deleteHouseholdCascade(session.householdId);
          sendJson(
            res,
            200,
            { ok: true },
            { 'Set-Cookie': formatSessionCookie(req, '', 0) }
          );
          return;
        }

        // Household Invite Management (authenticated Admin)
        if (pathname === '/api/invites') {
          const session = resolveSession(req);
          if (!session) {
            sendJson(res, 401, { error: 'AUTH_REQUIRED' });
            return;
          }
          if (session.role !== 'admin') {
            sendJson(res, 403, { error: 'ADMIN_ONLY' });
            return;
          }
          if (req.method === 'GET') {
            sendJson(res, 200, { invites: store.listInvites(session.householdId) });
            return;
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req, 16 * 1024);
            const inv = store.createInvite({
              householdId: session.householdId,
              role: body?.role,
              invitedEmail: body?.email,
              createdByUserId: session.userId,
            });
            const origin = resolveRequestOrigin(req, configuredBaseUrl);
            sendJson(res, 200, {
              ok: true,
              invite: inv,
              inviteUrl: `${origin}/invite?code=${encodeURIComponent(inv.code)}`,
            });
            return;
          }
        }

        // Billing & Subscriptions Routes (authenticated)
        if (pathname.startsWith('/api/billing/')) {
          const session = resolveSession(req);
          if (!session) {
            sendJson(res, 401, { error: 'AUTH_REQUIRED' });
            return;
          }
          if (!checkRateLimit(`billing:${session.householdId}`, 30, 60_000)) {
            sendJson(res, 429, { error: 'RATE_LIMITED' });
            return;
          }
          if (session.role === 'dependent') {
            sendJson(res, 403, { error: 'BILLING_RESTRICTED' });
            return;
          }

          if (req.method === 'GET' && pathname === '/api/billing/invoices') {
            sendJson(res, 200, {
              household: store.getHousehold(session.householdId),
              invoices: store.listInvoices(session.householdId),
            });
            return;
          }

          if (req.method === 'POST' && pathname === '/api/billing/trial') {
            const hh = store.getHousehold(session.householdId);
            if (hh?.trialEndsAt) {
              sendJson(res, 409, { error: 'TRIAL_ALREADY_USED' });
              return;
            }
            const trialEndsAt = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
            const updated = store.updateHouseholdBilling(session.householdId, {
              planTier: 'plus',
              planStatus: 'trialing',
              trialEndsAt,
            });
            broadcastEvent(session.householdId, 'billing_updated', { planTier: 'plus' });
            sendJson(res, 200, { ok: true, household: updated });
            return;
          }

          if (req.method === 'POST' && pathname === '/api/billing/checkout') {
            const body = await readJsonBody(req, 32 * 1024);
            const tier = body?.tier === 'advisor' ? 'advisor' : 'plus';
            const billingCycle = body?.billingCycle === 'monthly' ? 'monthly' : 'yearly';
            const currency = body?.currency === 'USD' ? 'USD' : 'INR';
            const origin = resolveRequestOrigin(req, configuredBaseUrl);
            const checkout = await createGatewayCheckout({
              householdId: session.householdId,
              userEmail: session.email,
              tier,
              billingCycle,
              currency,
              gstNumber: body?.gstNumber ? String(body.gstNumber).trim() : '',
              baseUrl: origin,
              env,
            });
            sendJson(res, 200, { ok: true, checkout });
            return;
          }

          if (req.method === 'POST' && pathname === '/api/billing/razorpay/verify') {
            const body = await readJsonBody(req, 32 * 1024);
            const orderId = String(body?.razorpay_order_id ?? '');
            const paymentId = String(body?.razorpay_payment_id ?? '');
            const signature = String(body?.razorpay_signature ?? '');
            const tier = body?.tier === 'advisor' ? 'advisor' : 'plus';
            const billingCycle = body?.billingCycle === 'monthly' ? 'monthly' : 'yearly';
            const secret = env.RAZORPAY_KEY_SECRET || '';
            if (!verifyRazorpayPaymentSignature({ orderId, paymentId, signature, secret })) {
              sendJson(res, 401, { error: 'INVALID_PAYMENT_SIGNATURE' });
              return;
            }
            const price = getPlanPriceMinor(tier, 'INR', billingCycle);
            const expiresAt = computePlanExpiryIso(billingCycle);
            const updated = store.updateHouseholdBilling(session.householdId, {
              planTier: tier,
              planStatus: 'active',
              billingCycle,
              planExpiresAt: expiresAt,
              billingProvider: 'razorpay',
            });
            store.recordInvoice({
              householdId: session.householdId,
              provider: 'razorpay',
              providerPaymentId: paymentId,
              providerOrderId: orderId,
              planTier: tier,
              billingCycle,
              currency: 'INR',
              amountMinor: price?.amountMinor ?? 79900,
              gstNumber: body?.gstNumber ? String(body.gstNumber).trim() : null,
              status: 'paid',
            });
            broadcastEvent(session.householdId, 'billing_updated', { planTier: tier });
            sendJson(res, 200, { ok: true, household: updated });
            return;
          }

          if (req.method === 'POST' && pathname === '/api/billing/sandbox/complete') {
            if (!allowSandboxBilling()) {
              sendJson(res, 403, { error: 'SANDBOX_BILLING_DISABLED' });
              return;
            }
            const body = await readJsonBody(req, 32 * 1024);
            const tier = body?.tier === 'advisor' ? 'advisor' : 'plus';
            const billingCycle = body?.billingCycle === 'monthly' ? 'monthly' : 'yearly';
            const currency = body?.currency === 'USD' ? 'USD' : 'INR';
            const price = getPlanPriceMinor(tier, currency, billingCycle);
            const expiresAt = computePlanExpiryIso(billingCycle);
            const updated = store.updateHouseholdBilling(session.householdId, {
              planTier: tier,
              planStatus: 'active',
              billingCycle,
              planExpiresAt: expiresAt,
              billingProvider: currency === 'INR' ? 'razorpay' : 'stripe',
            });
            store.recordInvoice({
              householdId: session.householdId,
              provider: currency === 'INR' ? 'razorpay-sandbox' : 'stripe-sandbox',
              providerPaymentId: `pay_sandbox_${Date.now()}`,
              providerOrderId: body?.orderId ? String(body.orderId) : `ord_sandbox_${Date.now()}`,
              planTier: tier,
              billingCycle,
              currency,
              amountMinor: price?.amountMinor ?? 79900,
              gstNumber: body?.gstNumber ? String(body.gstNumber).trim() : null,
              status: 'sandbox_paid',
            });
            broadcastEvent(session.householdId, 'billing_updated', { planTier: tier });
            sendJson(res, 200, { ok: true, household: updated });
            return;
          }
        }

        // Tenant-Scoped Sync Routes
        const tenant = resolveDataTenant(req);
        if (!tenant.ok) {
          sendJson(res, tenant.statusCode, { error: tenant.error });
          return;
        }
        const { householdId, role, session } = tenant;

        if (req.method === 'GET' && pathname === '/api/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          const snap = store.getSnapshot(householdId);
          res.write(`event: connected\ndata: ${JSON.stringify({ revision: snap.revision })}\n\n`);
          let set = sseChannels.get(householdId);
          if (!set) {
            set = new Set();
            sseChannels.set(householdId, set);
          }
          set.add(res);
          req.on('close', () => {
            set.delete(res);
            if (set.size === 0) sseChannels.delete(householdId);
          });
          return;
        }

        if (req.method === 'GET' && pathname === '/api/state') {
          const snap = store.getSnapshot(householdId);
          sendJson(res, 200, {
            ...snap,
            state: sanitizeStateForRole(snap.state, role),
          });
          return;
        }

        if (req.method === 'PUT' && pathname === '/api/state') {
          const body = await readJsonBody(req, 6 * 1024 * 1024);
          if (!body || !body.state || !Array.isArray(body.state.transactions)) {
            sendJson(res, 400, { error: 'INVALID_STATE_PAYLOAD' });
            return;
          }

          let nextState = body.state;
          if (session && (role === 'advisor' || role === 'dependent')) {
            // Preserve protected server fields from previous snapshot so restricted roles cannot alter them
            const existing = store.getSnapshot(householdId)?.state;
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

          const result = store.updateSnapshot({
            householdId,
            baseRevision: Number(body.baseRevision ?? 0),
            state: nextState,
            actor: body.actor,
            auditEntry: body.auditEntry,
            force: Boolean(body.force),
          });

          if (result.conflict) {
            sendJson(res, 409, {
              error: 'SYNC_CONFLICT',
              serverRevision: result.snapshot.revision,
              serverState: sanitizeStateForRole(result.snapshot.state, role),
              updatedAt: result.snapshot.updatedAt,
              activity: result.snapshot.activity,
            });
            return;
          }

          broadcastEvent(householdId, 'state_updated', {
            revision: result.revision,
            updatedAt: result.updatedAt,
            actorMemberId: body.actor?.memberId ?? null,
            actorName: body.actor?.memberName ?? null,
            clientId: body.clientId ?? null,
          });

          sendJson(res, 200, {
            revision: result.revision,
            updatedAt: result.updatedAt,
            activity: result.activity,
          });
          return;
        }

        if (req.method === 'GET' && pathname === '/api/receipts') {
          sendJson(res, 200, { receipts: store.listReceiptsMeta(householdId) });
          return;
        }

        if (pathname.startsWith('/api/receipts/')) {
          const id = decodeURIComponent(pathname.slice('/api/receipts/'.length));
          if (!id) {
            sendJson(res, 400, { error: 'MISSING_RECEIPT_ID' });
            return;
          }

          if (req.method === 'GET') {
            const rec = store.getReceipt(id, householdId);
            if (!rec) {
              sendJson(res, 404, { error: 'NOT_FOUND' });
              return;
            }
            sendJson(res, 200, rec);
            return;
          }

          if (req.method === 'PUT') {
            const body = await readJsonBody(req, 12 * 1024 * 1024);
            if (!body || typeof body.dataUrl !== 'string') {
              sendJson(res, 400, { error: 'INVALID_RECEIPT_PAYLOAD' });
              return;
            }
            store.saveReceipt(
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
            sendJson(res, 200, { ok: true, id });
            return;
          }

          if (req.method === 'DELETE') {
            store.deleteReceipt(id, householdId);
            sendJson(res, 200, { ok: true, id });
            return;
          }
        }

        sendJson(res, 404, { error: 'API_ROUTE_NOT_FOUND' });
      } catch (err) {
        const status = err?.statusCode || 500;
        sendJson(res, status, { error: err?.message || 'INTERNAL_SERVER_ERROR' });
      }
      return;
    }

    // Serve built static assets + SPA routes in production if dist/ exists
    if (fs.existsSync(distDir)) {
      const safeRelPath = path
        .normalize(pathname === '/' ? '/index.html' : pathname)
        .replace(/^(\.\.(\/|\\|$))+/, '');
      let filePath = path.join(distDir, safeRelPath);
      const isDirectAsset =
        filePath.startsWith(distDir) &&
        fs.existsSync(filePath) &&
        !fs.statSync(filePath).isDirectory();
      if (!isDirectAsset) {
        filePath = path.join(distDir, 'index.html');
      }
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const isImmutableAsset = pathname.startsWith('/assets/') && isDirectAsset;
        const cacheHeader = isImmutableAsset
          ? 'public, max-age=31536000, immutable'
          : 'no-cache';

        if (ext === '.html') {
          let html = fs.readFileSync(filePath, 'utf8');
          const origin = resolveRequestOrigin(req, configuredBaseUrl);
          const canonicalTag = `<link rel="canonical" href="${escapeHtmlAttr(origin + pathname)}" />`;
          const verificationTag = googleSiteVerification
            ? `\n    <meta name="google-site-verification" content="${escapeHtmlAttr(googleSiteVerification)}" />`
            : '';
          html = html.replace('</head>', `    ${canonicalTag}${verificationTag}\n  </head>`);
          res.writeHead(200, {
            'Content-Type': MIME_TYPES['.html'],
            'Cache-Control': 'no-cache',
          });
          res.end(html);
          return;
        }

        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
          'Cache-Control': cacheHeader,
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. Build the frontend with `npm run build` or run Vite dev server.');
  });

  const close = () =>
    new Promise((resolve) => {
      for (const clients of sseChannels.values()) {
        for (const client of clients) {
          try {
            client.end();
          } catch {
            // ignore
          }
        }
      }
      sseChannels.clear();
      server.close(() => {
        store.close();
        resolve();
      });
    });

  return { server, store, close };
}
