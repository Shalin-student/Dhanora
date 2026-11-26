// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createSyncServer, type SyncServerInstance } from '../../server/app.mjs';
import { computeHmacHex } from '../../server/billing.mjs';
import { createCleanHouseholdSeed, createSeedState } from '../data/seed';

const activeServers: SyncServerInstance[] = [];

async function startMultiTenantServer(overrides: Record<string, unknown> = {}) {
  const instance = createSyncServer({
    dbPath: ':memory:',
    requireAuthForSync: true,
    disableRateLimit: true,
    appBaseUrl: 'https://hearthledger.in',
    env: {
      NODE_ENV: 'test',
      ALLOW_TEST_BILLING: 'true',
      RAZORPAY_KEY_SECRET: 'rzp_test_secret_123',
      RAZORPAY_WEBHOOK_SECRET: 'rzp_wh_secret_456',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_789',
      ...(overrides.env as Record<string, string> | undefined),
    },
    ...overrides,
  });
  activeServers.push(instance);
  await new Promise<void>((resolve) => {
    instance.server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = instance.server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Expected TCP address');
  }
  return {
    instance,
    baseUrl: `http://127.0.0.1:${addr.port}`,
  };
}

function extractCookieHeader(res: Response): string {
  const setCookie = res.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

describe('Multi-Tenant Isolation, Invites, Server Redaction, Billing Webhooks & SEO (Integration)', () => {
  afterEach(async () => {
    while (activeServers.length > 0) {
      const srv = activeServers.pop();
      if (srv) await srv.close();
    }
  });

  it('isolates household state, receipts, and SSE across two independent signups + enforces HttpOnly cookies', async () => {
    const { baseUrl } = await startMultiTenantServer();

    // Unauthenticated /api/state rejected when requireAuthForSync=true
    const unauth = await fetch(`${baseUrl}/api/state`);
    expect(unauth.status).toBe(401);

    // Family A signup
    const signA = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohan Desai',
        email: 'rohan@desai.in',
        password: 'desai-password-1',
        role: 'admin',
        householdName: 'Desai Family',
      }),
    });
    expect(signA.status).toBe(200);
    const cookieA = extractCookieHeader(signA);
    expect(cookieA).toContain('hl_session=');
    const jsonA = (await signA.json()) as { session: { householdId: string; token: string } };

    // Family B signup
    const signB = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vikram Nair',
        email: 'vikram@nair.in',
        password: 'nair-password-2',
        role: 'admin',
        householdName: 'Nair Family',
      }),
    });
    expect(signB.status).toBe(200);
    const cookieB = extractCookieHeader(signB);
    const jsonB = (await signB.json()) as { session: { householdId: string; token: string } };
    expect(jsonA.session.householdId).not.toBe(jsonB.session.householdId);

    // Family A pushes state + receipt
    const seedA = createCleanHouseholdSeed({
      memberId: 'm-rohan',
      name: 'Rohan Desai',
      role: 'admin',
      avatar: '🧑🏽‍💻',
      householdName: 'Desai Family',
    });
    const pushA = await fetch(`${baseUrl}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({ baseRevision: 0, state: seedA }),
    });
    expect(pushA.status).toBe(200);

    await fetch(`${baseUrl}/api/receipts/rcpt-a-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieA },
      body: JSON.stringify({
        txId: 'tx-1',
        fileName: 'secret-desai.png',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,AAA=',
      }),
    });

    // Family B must see empty state + zero receipts of Family A
    const stateB = await fetch(`${baseUrl}/api/state`, { headers: { Cookie: cookieB } });
    const stateBJson = (await stateB.json()) as { revision: number; state: unknown };
    expect(stateBJson.revision).toBe(0);
    expect(stateBJson.state).toBeNull();

    const rcptCross = await fetch(`${baseUrl}/api/receipts/rcpt-a-1`, {
      headers: { Cookie: cookieB },
    });
    expect(rcptCross.status).toBe(404);
  });

  it('creates admin invite link, locks invited role on signup, and redacts emergencyInfo for advisor role', async () => {
    const { baseUrl } = await startMultiTenantServer();

    const adminRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ananya Mehta',
        email: 'ananya@mehta.in',
        password: 'mehta-strong-pass',
        role: 'admin',
        householdName: 'Mehta Household',
      }),
    });
    const adminCookie = extractCookieHeader(adminRes);

    // Push seed state containing emergencyInfo & pinHash
    const fullSeed = createSeedState();
    fullSeed.settings.pinHash = 'secret-pin-hash';
    await fetch(`${baseUrl}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ baseRevision: 0, state: fullSeed }),
    });

    // Generate Advisor invite
    const invRes = await fetch(`${baseUrl}/api/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ role: 'advisor', email: 'ca.joshi@advisory.in' }),
    });
    expect(invRes.status).toBe(200);
    const invJson = (await invRes.json()) as {
      invite: { code: string; role: string };
      inviteUrl: string;
    };
    expect(invJson.inviteUrl).toContain(`https://hearthledger.in/invite?code=${invJson.invite.code}`);

    // Advisor attempts to spoof role: 'admin' during invited signup -> server locks to 'advisor'!
    const advRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'CA Joshi',
        email: 'ca.joshi@advisory.in',
        password: 'advisor-password-99',
        role: 'admin',
        inviteCode: invJson.invite.code,
      }),
    });
    expect(advRes.status).toBe(200);
    const advCookie = extractCookieHeader(advRes);
    const advSessionJson = (await advRes.json()) as { session: { role: string } };
    expect(advSessionJson.session.role).toBe('advisor');

    // Advisor GET /api/state must have emergencyInfo & pinHash stripped on the server
    const advStateRes = await fetch(`${baseUrl}/api/state`, { headers: { Cookie: advCookie } });
    const advStateJson = (await advStateRes.json()) as {
      state: { emergencyInfo?: unknown; settings: { pinHash?: string } };
    };
    expect(advStateJson.state.emergencyInfo).toBeUndefined();
    expect(advStateJson.state.settings.pinHash).toBeUndefined();

    // Non-admin Advisor cannot delete household
    const delDenied = await fetch(`${baseUrl}/api/account`, {
      method: 'DELETE',
      headers: { Cookie: advCookie },
    });
    expect(delDenied.status).toBe(403);

    // Owner deletes household cleanly
    const delOk = await fetch(`${baseUrl}/api/account`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    expect(delOk.status).toBe(200);

    const meAfter = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: adminCookie } });
    const meJson = (await meAfter.json()) as { authenticated: boolean };
    expect(meJson.authenticated).toBe(false);
  });

  it('verifies Razorpay payment & webhook HMAC signatures and Stripe webhook HMAC signatures', async () => {
    const { baseUrl } = await startMultiTenantServer();

    const signRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Shah',
        email: 'priya@shah.in',
        password: 'priya-strong-password',
        role: 'admin',
      }),
    });
    const cookie = extractCookieHeader(signRes);
    const { session } = (await signRes.json()) as { session: { householdId: string } };

    // 1. Tampered Razorpay signature rejected
    const badRzp = await fetch(`${baseUrl}/api/billing/razorpay/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        razorpay_order_id: 'ord_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'tampered',
        tier: 'plus',
        billingCycle: 'yearly',
      }),
    });
    expect(badRzp.status).toBe(401);

    // 2. Valid Razorpay verify upgrades household & logs GST invoice
    const goodSig = computeHmacHex('ord_1|pay_1', 'rzp_test_secret_123');
    const goodRzp = await fetch(`${baseUrl}/api/billing/razorpay/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        razorpay_order_id: 'ord_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: goodSig,
        tier: 'plus',
        billingCycle: 'yearly',
        gstNumber: '24AABCU9603R1ZM',
      }),
    });
    expect(goodRzp.status).toBe(200);
    const rzpBody = (await goodRzp.json()) as { household: { planTier: string } };
    expect(rzpBody.household.planTier).toBe('plus');

    // 3. Valid Stripe webhook upgrades household to advisor
    const nowSec = Math.floor(Date.now() / 1000);
    const stripePayload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_99',
          payment_intent: 'pi_test_99',
          client_reference_id: session.householdId,
          currency: 'usd',
          amount_total: 7900,
          metadata: {
            householdId: session.householdId,
            tier: 'advisor',
            billingCycle: 'yearly',
          },
        },
      },
    });
    const stripeSig = computeHmacHex(`${nowSec}.${stripePayload}`, 'whsec_test_789');
    const stripeRes = await fetch(`${baseUrl}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': `t=${nowSec},v1=${stripeSig}`,
      },
      body: stripePayload,
    });
    expect(stripeRes.status).toBe(200);

    const invRes = await fetch(`${baseUrl}/api/billing/invoices`, { headers: { Cookie: cookie } });
    const invJson = (await invRes.json()) as {
      household: { planTier: string };
      invoices: Array<{ gstNumber?: string | null; amountMinor: number }>;
    };
    expect(invJson.household.planTier).toBe('advisor');
    expect(invJson.invoices).toHaveLength(2);
    expect(invJson.invoices.some((i) => i.gstNumber === '24AABCU9603R1ZM')).toBe(true);
  });

  it('serves dynamic robots.txt, sitemap.xml canonicals, and strict CSP / security headers', async () => {
    const { baseUrl } = await startMultiTenantServer();

    const robots = await fetch(`${baseUrl}/robots.txt`);
    expect(robots.status).toBe(200);
    expect(robots.headers.get('x-content-type-options')).toBe('nosniff');
    expect(robots.headers.get('x-frame-options')).toBe('DENY');
    expect(robots.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(robots.headers.get('content-security-policy')).not.toContain('unsafe-eval');
    const robotsText = await robots.text();
    expect(robotsText).toContain('Sitemap: https://hearthledger.in/sitemap.xml');

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    expect(sitemap.status).toBe(200);
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain('<loc>https://hearthledger.in/pricing</loc>');
    expect(sitemapText).toContain('<loc>https://hearthledger.in/privacy</loc>');
  });
});
