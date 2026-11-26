// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCleanHouseholdSeed, createSeedState } from '../data/seed';
import {
  computeHmacHexWeb,
  createMockD1Database,
  onRequest,
  type MockD1Database,
} from './sqliteD1TestHelper.mjs';

function callEdgeApi(
  db: MockD1Database,
  path: string,
  init: RequestInit = {},
  envOverrides: Record<string, unknown> = {}
) {
  const url = `https://hearthledger-7ar.pages.dev${path}`;
  const req = new Request(url, init);
  return onRequest({
    request: req,
    env: {
      DB: db,
      APP_BASE_URL: 'https://hearthledger-7ar.pages.dev',
      DISABLE_RATE_LIMIT: 'true',
      ...envOverrides,
    },
  });
}

function cookieFromResponse(res: Response): string {
  const raw = res.headers.get('set-cookie') || '';
  return raw.split(';')[0];
}

describe('Cloudflare Pages Functions + D1 Backend Integration', () => {
  const dbs: MockD1Database[] = [];
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    while (dbs.length > 0) {
      dbs.pop()?.close();
    }
  });

  function freshDb() {
    const db = createMockD1Database();
    dbs.push(db);
    return db;
  }

  it('returns clear 503 diagnostic when DB binding is missing and bootstraps schema on first health check', async () => {
    const missing = await onRequest({
      request: new Request('https://hearthledger-7ar.pages.dev/api/health'),
      env: {},
    });
    expect(missing.status).toBe(503);
    expect(((await missing.json()) as { error: string }).error).toBe('D1_NOT_CONFIGURED');

    const db = freshDb();
    const ok = await callEdgeApi(db, '/api/health');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      ok: true,
      engine: 'd1',
      authRequired: true,
    });

    const sse = await callEdgeApi(db, '/api/events');
    expect(sse.status).toBe(204);
  });

  it('isolates multi-tenant auth, enforces invite role lock, redacts advisor data, and handles state conflicts', async () => {
    const db = freshDb();

    // Unauthenticated rejected by default on Cloudflare Edge
    const unauth = await callEdgeApi(db, '/api/state');
    expect(unauth.status).toBe(401);

    // Signup choosing paid advisor plan still starts on free tier until paid checkout completes
    const advChoiceSignup = await callEdgeApi(db, '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Shalin Patel',
        email: 'shalin@patel.in',
        password: 'shalin-strong-password',
        role: 'admin',
        planTier: 'advisor',
        householdName: 'Patel Household',
      }),
    });
    expect(advChoiceSignup.status).toBe(200);
    const setCookieHeader = advChoiceSignup.headers.get('set-cookie') || '';
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('Secure');
    const cookieAdmin = cookieFromResponse(advChoiceSignup);
    const signupJson = (await advChoiceSignup.json()) as { session: { planTier: string } };
    expect(signupJson.session.planTier).toBe('free');

    // Push state containing sensitive emergencyInfo + pinHash
    const seed = createSeedState();
    seed.settings.pinHash = 'secret-pin-hash';
    const push1 = await callEdgeApi(db, '/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAdmin },
      body: JSON.stringify({
        baseRevision: 0,
        state: seed,
        auditEntry: { action: 'init', summary: 'Initialized Patel ledger', entityType: 'sync' },
      }),
    });
    expect(push1.status).toBe(200);

    // Optimistic locking conflict check (stale baseRevision 0)
    const stale = await callEdgeApi(db, '/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAdmin },
      body: JSON.stringify({
        baseRevision: 0,
        state: createCleanHouseholdSeed({
          memberId: 'm-1',
          name: 'Shalin',
          role: 'admin',
          avatar: '🧑🏽‍💻',
        }),
      }),
    });
    expect(stale.status).toBe(409);

    // Invite advisor -> locks role even if client passes role:'admin'
    const invRes = await callEdgeApi(db, '/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAdmin },
      body: JSON.stringify({ role: 'advisor', email: 'ca@firm.in' }),
    });
    const invBody = (await invRes.json()) as {
      invite: { code: string };
      inviteUrl: string;
    };
    expect(invBody.inviteUrl).toContain(`https://hearthledger-7ar.pages.dev/invite?code=${invBody.invite.code}`);

    const advSignup = await callEdgeApi(db, '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'CA Mehta',
        email: 'ca@firm.in',
        password: 'ca-password-123',
        role: 'admin',
        inviteCode: invBody.invite.code,
      }),
    });
    expect(advSignup.status).toBe(200);
    const cookieAdv = cookieFromResponse(advSignup);
    expect(((await advSignup.json()) as { session: { role: string } }).session.role).toBe('advisor');

    // Invite cannot be reused
    const reuse = await callEdgeApi(db, '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Intruder',
        email: 'ca@firm.in',
        password: 'password-999',
        inviteCode: invBody.invite.code,
      }),
    });
    expect([400, 409]).toContain(reuse.status);

    // Advisor GET /api/state redacts emergencyInfo & pinHash
    const advState = await callEdgeApi(db, '/api/state', { headers: { Cookie: cookieAdv } });
    const advJson = (await advState.json()) as {
      state: { emergencyInfo?: unknown; settings: { pinHash?: string } };
    };
    expect(advJson.state.emergencyInfo).toBeUndefined();
    expect(advJson.state.settings.pinHash).toBeUndefined();

    // Separate second household cannot read receipts from first household
    await callEdgeApi(db, '/api/receipts/rcpt-patel-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAdmin },
      body: JSON.stringify({
        txId: 'tx-1',
        fileName: 'bill.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,AAA=',
      }),
    });

    const otherSignup = await callEdgeApi(db, '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Other User',
        email: 'other@user.in',
        password: 'other-password-1',
      }),
    });
    const cookieOther = cookieFromResponse(otherSignup);
    const crossReceipt = await callEdgeApi(db, '/api/receipts/rcpt-patel-1', {
      headers: { Cookie: cookieOther },
    });
    expect(crossReceipt.status).toBe(404);

    const overwriteReceipt = await callEdgeApi(db, '/api/receipts/rcpt-patel-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieOther },
      body: JSON.stringify({ dataUrl: 'data:image/png;base64,BBB=' }),
    });
    expect(overwriteReceipt.status).toBe(403);

    // Non-admin advisor cannot delete household
    const deniedDel = await callEdgeApi(db, '/api/account', {
      method: 'DELETE',
      headers: { Cookie: cookieAdv },
    });
    expect(deniedDel.status).toBe(403);

    // Admin cascade delete succeeds
    const adminDel = await callEdgeApi(db, '/api/account', {
      method: 'DELETE',
      headers: { Cookie: cookieAdmin },
    });
    expect(adminDel.status).toBe(200);
  });

  it('rejects unconfigured live checkout, creates Razorpay orders, prevents tier spoofing, and verifies webhooks', async () => {
    const db = freshDb();

    const signup = await callEdgeApi(db, '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Mehta',
        email: 'priya@mehta.in',
        password: 'priya-strong-password',
      }),
    });
    const cookie = cookieFromResponse(signup);
    const { session } = (await signup.json()) as { session: { householdId: string } };

    // 1. Live mode without Razorpay keys NEVER falls back to free sandbox
    const noKeys = await callEdgeApi(
      db,
      '/api/billing/checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ tier: 'plus', billingCycle: 'yearly', currency: 'INR' }),
      },
      {}
    );
    expect(noKeys.status).toBe(503);
    expect(((await noKeys.json()) as { error: string }).error).toBe('BILLING_KEYS_NOT_CONFIGURED');

    // 2. Trial activates once and rejects second call
    const trial1 = await callEdgeApi(db, '/api/billing/trial', {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(trial1.status).toBe(200);
    const trial2 = await callEdgeApi(db, '/api/billing/trial', {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(trial2.status).toBe(409);

    // 3. Razorpay Order API + D1 billing_orders binding
    globalThis.fetch = vi.fn(async (input) => {
      expect(String(input)).toBe('https://api.razorpay.com/v1/orders');
      return new Response(JSON.stringify({ id: 'order_rzp_live_101', amount: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const envKeys = {
      RAZORPAY_KEY_ID: 'rzp_live_demo_key',
      RAZORPAY_KEY_SECRET: 'rzp_live_secret_xyz',
      RAZORPAY_WEBHOOK_SECRET: 'rzp_wh_secret_999',
    };

    const checkoutRes = await callEdgeApi(
      db,
      '/api/billing/checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ tier: 'plus', billingCycle: 'yearly', currency: 'INR' }),
      },
      envKeys
    );
    expect(checkoutRes.status).toBe(200);
    const checkoutJson = (await checkoutRes.json()) as {
      checkout: Record<string, unknown>;
    };
    expect(checkoutJson.checkout).toMatchObject({
      provider: 'razorpay',
      mode: 'live',
      keyId: 'rzp_live_demo_key',
      orderId: 'order_rzp_live_101',
      amountMinor: 100,
    });

    // 4. Verify signature prevents tampering AND enforces original server order tier ('plus' even if attacker sends 'advisor')
    const validSig = await computeHmacHexWeb(
      'order_rzp_live_101|pay_rzp_live_202',
      envKeys.RAZORPAY_KEY_SECRET
    );
    const verifyRes = await callEdgeApi(
      db,
      '/api/billing/razorpay/verify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          razorpay_order_id: 'order_rzp_live_101',
          razorpay_payment_id: 'pay_rzp_live_202',
          razorpay_signature: validSig,
          tier: 'advisor',
          billingCycle: 'yearly',
        }),
      },
      envKeys
    );
    expect(verifyRes.status).toBe(200);
    const verifiedBody = (await verifyRes.json()) as {
      household: { planTier: string; planStatus: string };
    };
    expect(verifiedBody.household.planTier).toBe('plus');
    expect(verifiedBody.household.planStatus).toBe('active');

    // 5. Webhook verification via WebCrypto upgrades household to Advisor when genuine paid webhook arrives
    const whPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_wh_303',
            order_id: 'order_wh_303',
            currency: 'INR',
            amount: 200,
            notes: {
              householdId: session.householdId,
              tier: 'advisor',
              billingCycle: 'yearly',
            },
          },
        },
      },
    });
    const whSig = await computeHmacHexWeb(whPayload, envKeys.RAZORPAY_WEBHOOK_SECRET);
    const whRes = await callEdgeApi(
      db,
      '/api/webhooks/razorpay',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': whSig,
        },
        body: whPayload,
      },
      envKeys
    );
    expect(whRes.status).toBe(200);

    const invRes = await callEdgeApi(db, '/api/billing/invoices', {
      headers: { Cookie: cookie },
    });
    const invJson = (await invRes.json()) as {
      household: { planTier: string };
      invoices: unknown[];
    };
    expect(invJson.household.planTier).toBe('advisor');
    expect(invJson.invoices).toHaveLength(2);
  });

  it('handles forgot-password reset flow via Resend, invalidates old sessions, validates promo codes, and stores feedback', async () => {
    const db = freshDb();
    let capturedResetToken = '';
    const emailCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

    globalThis.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
      emailCalls.push({ url, body: parsedBody });
      if (url === 'https://api.resend.com/emails') {
        const html = String(parsedBody.html || '');
        const match = html.match(/token=([a-f0-9]+)/i);
        if (match) capturedResetToken = match[1];
        return new Response(JSON.stringify({ id: 'email_test_123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === 'https://api.razorpay.com/v1/orders') {
        return new Response(
          JSON.stringify({ id: 'order_promo_101', amount: parsedBody.amount }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    const envVars = {
      RESEND_API_KEY: 're_test_key_123',
      RAZORPAY_KEY_ID: 'rzp_live_demo',
      RAZORPAY_KEY_SECRET: 'rzp_secret_demo',
    };

    // 1. Signup + capture old session cookie
    const signup = await callEdgeApi(
      db,
      '/api/auth/signup',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Meera Desai',
          email: 'meera@desai.in',
          password: 'old-password-11',
        }),
      },
      envVars
    );
    const oldCookie = cookieFromResponse(signup);

    // 2. Forgot password sends Resend email with reset token
    const forgot = await callEdgeApi(
      db,
      '/api/auth/forgot-password',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'meera@desai.in' }),
      },
      envVars
    );
    expect(forgot.status).toBe(200);
    expect(((await forgot.json()) as { delivery: string }).delivery).toBe('email_queued');
    expect(capturedResetToken.length).toBeGreaterThan(20);

    // 3. Reset password succeeds once, rejects reuse, and invalidates old session cookie
    const resetOk = await callEdgeApi(
      db,
      '/api/auth/reset-password',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: capturedResetToken, newPassword: 'new-strong-password-99' }),
      },
      envVars
    );
    expect(resetOk.status).toBe(200);

    const resetReuse = await callEdgeApi(
      db,
      '/api/auth/reset-password',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: capturedResetToken, newPassword: 'another-password-11' }),
      },
      envVars
    );
    expect(resetReuse.status).toBe(400);

    const oldMe = await callEdgeApi(db, '/api/auth/me', { headers: { Cookie: oldCookie } }, envVars);
    expect(((await oldMe.json()) as { authenticated: boolean }).authenticated).toBe(false);

    // Sign in with new password works
    const relogin = await callEdgeApi(
      db,
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'meera@desai.in', password: 'new-strong-password-99' }),
      },
      envVars
    );
    expect(relogin.status).toBe(200);
    const newCookie = cookieFromResponse(relogin);

    // 4. Promo validation & discounted Razorpay checkout
    const badPromo = await callEdgeApi(
      db,
      '/api/billing/validate-promo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newCookie },
        body: JSON.stringify({
          tier: 'advisor',
          billingCycle: 'yearly',
          currency: 'INR',
          promoCode: 'FAKE99',
        }),
      },
      envVars
    );
    expect(badPromo.status).toBe(404);

    const goodPromo = await callEdgeApi(
      db,
      '/api/billing/validate-promo',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newCookie },
        body: JSON.stringify({
          tier: 'advisor',
          billingCycle: 'yearly',
          currency: 'INR',
          promoCode: 'student50',
        }),
      },
      envVars
    );
    expect(goodPromo.status).toBe(200);
    expect(((await goodPromo.json()) as { promo: { finalAmountMinor: number } }).promo.finalAmountMinor).toBe(
      100
    );

    const promoCheckout = await callEdgeApi(
      db,
      '/api/billing/checkout',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newCookie },
        body: JSON.stringify({
          tier: 'advisor',
          billingCycle: 'yearly',
          currency: 'INR',
          promoCode: 'STUDENT50',
        }),
      },
      envVars
    );
    expect(promoCheckout.status).toBe(200);
    expect(
      ((await promoCheckout.json()) as { checkout: { amountMinor: number; promoCode: string } }).checkout
    ).toMatchObject({ amountMinor: 100, promoCode: 'STUDENT50' });

    // 5. Feedback save & Resend alert
    const fbPost = await callEdgeApi(
      db,
      '/api/feedback',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newCookie },
        body: JSON.stringify({
          category: 'feature',
          message: 'Please add SIP step-up CSV export too!',
          pageView: 'pricing',
        }),
      },
      envVars
    );
    expect(fbPost.status).toBe(200);

    const fbList = await callEdgeApi(db, '/api/feedback', { headers: { Cookie: newCookie } }, envVars);
    expect(fbList.status).toBe(200);
    expect(((await fbList.json()) as { feedback: Array<{ message: string }> }).feedback[0].message).toContain(
      'SIP step-up CSV'
    );
    expect(emailCalls.some((c) => c.url === 'https://api.resend.com/emails')).toBe(true);
  });
});
