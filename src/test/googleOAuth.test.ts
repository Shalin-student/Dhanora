// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSyncServer, type SyncServerInstance } from '../../server/app.mjs';
import { createSyncDatabase } from '../../server/db.mjs';
import { createD1Store, ensureD1Schema } from '../../server/edge/d1Store.mjs';
import {
  buildGoogleAuthorizeUrl,
  buildGoogleState,
  exchangeGoogleCode,
  verifyGoogleState,
} from '../../server/edge/oauthCore.mjs';
import {
  createLegacyPreOAuthSqliteFile,
  createMockD1Database,
  onRequest,
  type MockD1Database,
} from './sqliteD1TestHelper.mjs';

const OAUTH_ENV = {
  GOOGLE_CLIENT_ID: 'google-client-id-123.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-client-secret-xyz',
  SESSION_HMAC_SECRET: 'session-hmac-secret-abc',
};

function callEdgeApi(
  db: MockD1Database,
  reqPath: string,
  init: RequestInit = {},
  envOverrides: Record<string, unknown> = {}
) {
  const url = `https://hearthledger-7ar.pages.dev${reqPath}`;
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

function createMockGoogleFetch(profileOverrides: Record<string, unknown> = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(
        JSON.stringify({
          access_token: 'mock-google-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
      return new Response(
        JSON.stringify({
          sub: 'google-sub-1001',
          email: 'Aarav.Patel@Example.com',
          email_verified: true,
          name: 'Aarav Patel',
          picture: 'https://lh3.googleusercontent.com/a/avatar.png',
          ...profileOverrides,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
}

describe('Google OAuth 2.0 Core, Dual-Store Parity & HTTP Routes', () => {
  const activeServers: SyncServerInstance[] = [];
  const dbs: MockD1Database[] = [];
  const cleanups: Array<() => void> = [];
  const originalFetch = globalThis.fetch;

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    while (activeServers.length > 0) {
      const srv = activeServers.pop();
      if (srv) await srv.close();
    }
    while (dbs.length > 0) {
      dbs.pop()?.close();
    }
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  function freshD1() {
    const db = createMockD1Database();
    dbs.push(db);
    return db;
  }

  async function startNodeServer(
    envOverrides: Record<string, string | undefined> = {},
    fetchImpl?: typeof fetch
  ) {
    const instance = createSyncServer({
      dbPath: ':memory:',
      requireAuthForSync: true,
      disableRateLimit: true,
      env: {
        NODE_ENV: 'test',
        ...envOverrides,
      },
      fetchImpl,
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

  describe('oauthCore.mjs (Web Crypto HMAC State & Token Exchange)', () => {
    it('builds and verifies HMAC-SHA256 state round-trip and sanitizes fields', async () => {
      const state = await buildGoogleState({
        secret: OAUTH_ENV.SESSION_HMAC_SECRET,
        mode: 'signup',
        inviteCode: '  inv-code-77  ',
        nextPlan: 'plus',
      });
      expect(state).toContain('.');
      const verified = await verifyGoogleState({
        secret: OAUTH_ENV.SESSION_HMAC_SECRET,
        state,
      });
      expect(verified).toMatchObject({
        ok: true,
        mode: 'signup',
        inviteCode: 'inv-code-77',
        nextPlan: 'plus',
      });
    });

    it('rejects tampered state, wrong secret, malformed state, and expired state', async () => {
      const state = await buildGoogleState({
        secret: OAUTH_ENV.SESSION_HMAC_SECRET,
        mode: 'signin',
        nextPlan: 'advisor',
      });

      const [payloadB64, sigB64] = state.split('.');
      const tamperedSig = `${sigB64.slice(0, -1)}${sigB64.endsWith('A') ? 'B' : 'A'}`;
      expect(
        await verifyGoogleState({
          secret: OAUTH_ENV.SESSION_HMAC_SECRET,
          state: `${payloadB64}.${tamperedSig}`,
        })
      ).toEqual({ ok: false, error: 'google_invalid_state' });

      expect(
        await verifyGoogleState({
          secret: 'wrong-secret',
          state,
        })
      ).toEqual({ ok: false, error: 'google_invalid_state' });

      expect(
        await verifyGoogleState({
          secret: OAUTH_ENV.SESSION_HMAC_SECRET,
          state: 'not-a-valid-state',
        })
      ).toEqual({ ok: false, error: 'google_invalid_state' });

      const expiredState = await buildGoogleState({
        secret: OAUTH_ENV.SESSION_HMAC_SECRET,
        ttlMs: -1000,
      });
      expect(
        await verifyGoogleState({
          secret: OAUTH_ENV.SESSION_HMAC_SECRET,
          state: expiredState,
        })
      ).toEqual({ ok: false, error: 'google_state_expired' });
    });

    it('builds Google authorize URL and exchanges code via mocked fetch', async () => {
      const authUrl = buildGoogleAuthorizeUrl({
        clientId: OAUTH_ENV.GOOGLE_CLIENT_ID,
        redirectUri: 'https://hearthledger-7ar.pages.dev/api/auth/google/callback',
        state: 'signed.state',
      });
      const parsed = new URL(authUrl);
      expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(parsed.searchParams.get('client_id')).toBe(OAUTH_ENV.GOOGLE_CLIENT_ID);
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('openid email profile');
      expect(parsed.searchParams.get('prompt')).toBe('select_account');
      expect(parsed.searchParams.get('state')).toBe('signed.state');

      const mockFetch = createMockGoogleFetch();
      const profile = await exchangeGoogleCode({
        code: 'auth-code-1',
        clientId: OAUTH_ENV.GOOGLE_CLIENT_ID,
        clientSecret: OAUTH_ENV.GOOGLE_CLIENT_SECRET,
        redirectUri: 'https://hearthledger-7ar.pages.dev/api/auth/google/callback',
        fetchImpl: mockFetch,
      });
      expect(profile).toEqual({
        sub: 'google-sub-1001',
        email: 'aarav.patel@example.com',
        email_verified: true,
        name: 'Aarav Patel',
        picture: 'https://lh3.googleusercontent.com/a/avatar.png',
      });

      const badTokenFetch = vi.fn(async () => new Response('Bad Request', { status: 400 }));
      await expect(
        exchangeGoogleCode({
          code: 'bad-code',
          clientId: OAUTH_ENV.GOOGLE_CLIENT_ID,
          clientSecret: OAUTH_ENV.GOOGLE_CLIENT_SECRET,
          redirectUri: 'https://hearthledger-7ar.pages.dev/api/auth/google/callback',
          fetchImpl: badTokenFetch as unknown as typeof fetch,
        })
      ).rejects.toMatchObject({ code: 'google_token_exchange_failed' });
    });
  });

  describe('Dual-Store Parity (SQLite db.mjs & D1 d1Store.mjs)', () => {
    it('migrates legacy pre-OAuth users tables idempotently in both SQLite and D1', async () => {
      // 1. Legacy SQLite DB without auth_provider / google_sub / billing_orders
      const legacy = createLegacyPreOAuthSqliteFile();
      cleanups.push(legacy.cleanup);

      const sqliteStore = createSyncDatabase(legacy.dbPath);
      const created = sqliteStore.upsertGoogleUser({
        email: 'legacy@family.in',
        name: 'Legacy User',
        googleSub: 'sub-legacy-1',
        avatarUrl: 'https://example.com/pic.png',
        emailVerified: true,
      });
      expect(created.isNewUser).toBe(true);
      sqliteStore.savePendingOrder({
        orderId: 'ord_mig_1',
        householdId: created.householdId,
        provider: 'razorpay',
        planTier: 'plus',
        billingCycle: 'yearly',
        currency: 'INR',
        amountMinor: 100,
      });
      expect(sqliteStore.getPendingOrder('ord_mig_1')?.planTier).toBe('plus');
      sqliteStore.close();

      // 2. Legacy D1 DB without auth_provider / google_sub
      const mockD1 = freshD1();
      await mockD1.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          household_id TEXT NOT NULL DEFAULT 'default',
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          member_id TEXT NOT NULL,
          avatar TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      await ensureD1Schema(mockD1);
      const d1Store = createD1Store(mockD1);
      const d1Created = await d1Store.upsertGoogleUser({
        email: 'legacy@family.in',
        name: 'Legacy User',
        googleSub: 'sub-legacy-1',
        avatarUrl: 'https://example.com/pic.png',
        emailVerified: true,
      });
      expect(d1Created.isNewUser).toBe(true);
    });

    it('enforces identical upsertGoogleUser, invite consumption, account linking, and empty-password guards across SQLite and D1', async () => {
      const sqliteStore = createSyncDatabase(':memory:');
      const mockD1 = freshD1();
      await ensureD1Schema(mockD1);
      const d1Store = createD1Store(mockD1);

      try {
        for (const kind of ['sqlite', 'd1'] as const) {
          const run = async <T>(fn: () => T | Promise<T>) => await fn();
          const store = kind === 'sqlite' ? sqliteStore : d1Store;

          // 1. Unverified email rejected (strict boolean true required; truthy strings/numbers rejected)
          for (const badVerified of [
            false,
            'false' as unknown as boolean,
            '0' as unknown as boolean,
            1 as unknown as boolean,
            undefined as unknown as boolean,
          ]) {
            await expect(
              run(() =>
                store.upsertGoogleUser({
                  email: 'unverified@patel.in',
                  name: 'Unverified',
                  googleSub: 'sub-unv',
                  emailVerified: badVerified,
                })
              )
            ).rejects.toMatchObject({ code: 'google_email_unverified' });
          }

          // 1b. Unsafe/overlong avatar values fall back to role emoji; short emoji preserved
          for (const [idx, badAvatar] of [
            'data:image/png;base64,AAAA',
            'javascript:alert(1)',
            'https://example.com/pic.png',
            'a'.repeat(17),
          ].entries()) {
            const safeAvatarUser = await run(() =>
              store.upsertGoogleUser({
                email: `avatar-safe-${idx}@example.com`,
                name: 'Avatar Check',
                googleSub: `sub-avatar-safe-${idx}`,
                avatarUrl: badAvatar,
                emailVerified: true,
              })
            );
            expect(safeAvatarUser.avatar).toBe('🧑🏽‍💻');
          }
          const emojiAvatarUser = await run(() =>
            store.upsertGoogleUser({
              email: 'avatar-emoji@example.com',
              name: 'Emoji User',
              googleSub: 'sub-avatar-emoji',
              avatarUrl: '🧑🏽‍🚀',
              emailVerified: true,
            })
          );
          expect(emojiAvatarUser.avatar).toBe('🧑🏽‍🚀');

          // 2. New OAuth user creates "<First Name>'s Household" and guards empty password
          const newUser = await run(() =>
            store.upsertGoogleUser({
              email: 'Kavya.Shah@Example.com',
              name: 'Kavya Shah',
              googleSub: 'sub-kavya-1',
              avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
              emailVerified: true,
            })
          );
          expect(newUser.isNewUser).toBe(true);
          expect(newUser.role).toBe('admin');
          expect(newUser.avatar).toBe('🧑🏽‍💻');
          const hh = await run(() => store.getHousehold(newUser.householdId));
          expect(hh?.name).toBe("Kavya's Household");
          expect(hh?.planTier).toBe('free');

          expect(await run(() => store.verifyUserLogin('kavya.shah@example.com', ''))).toBeNull();
          expect(
            await run(() => store.rotateUserPassword(newUser.userId, '', 'new-pass-123'))
          ).toEqual({ ok: false, error: 'OAUTH_ACCOUNT_NO_PASSWORD' });

          // 3. Existing password user links by case-insensitive email and keeps password login working
          const pwCreated = await run(() =>
            store.createUser({
              name: 'Rohan Mehta',
              email: 'rohan@mehta.in',
              password: 'rohan-secret-password',
              role: 'admin',
              memberId: 'm-rohan',
              avatar: '🧑🏽‍💻',
              householdName: 'Mehta Vault',
            })
          );
          if (!pwCreated.session) throw new Error('Expected session');

          const linked = await run(() =>
            store.upsertGoogleUser({
              email: 'ROHAN@MEHTA.IN',
              name: 'Rohan Mehta',
              googleSub: 'sub-rohan-99',
              avatarUrl: 'https://lh3.googleusercontent.com/rohan.jpg',
              emailVerified: true,
            })
          );
          expect(linked.isNewUser).toBe(false);
          expect(linked.userId).toBe(pwCreated.session.userId);
          expect(linked.householdId).toBe(pwCreated.session.householdId);

          // Password login still works after linking Google
          const pwLogin = await run(() =>
            store.verifyUserLogin('ROHAN@MEHTA.IN', 'rohan-secret-password')
          );
          expect(pwLogin?.userId).toBe(pwCreated.session.userId);

          // Mismatched google_sub rejected
          await expect(
            run(() =>
              store.upsertGoogleUser({
                email: 'rohan@mehta.in',
                name: 'Attacker',
                googleSub: 'sub-different-hacker',
                emailVerified: true,
              })
            )
          ).rejects.toMatchObject({ code: 'google_account_mismatch' });

          // 4. Invite joining locks role, normalizes invitedEmail parity, and consumes invite single-use
          const inv = await run(() =>
            store.createInvite({
              householdId: pwCreated.session!.householdId,
              role: 'advisor',
              invitedEmail: '  CA@Advisory.IN  ',
              createdByUserId: pwCreated.session!.userId,
            })
          );
          expect(inv.invitedEmail).toBe('ca@advisory.in');

          // Email mismatch rejected
          await expect(
            run(() =>
              store.upsertGoogleUser({
                email: 'other@advisory.in',
                name: 'Other CA',
                googleSub: 'sub-other-ca',
                inviteCode: inv.code,
                emailVerified: true,
              })
            )
          ).rejects.toMatchObject({ code: 'google_invite_invalid' });

          const joined = await run(() =>
            store.upsertGoogleUser({
              email: 'ca@advisory.in',
              name: 'CA Advisory',
              googleSub: 'sub-ca-1',
              inviteCode: inv.code,
              emailVerified: true,
            })
          );
          expect(joined.isNewUser).toBe(true);
          expect(joined.householdId).toBe(pwCreated.session.householdId);
          expect(joined.role).toBe('advisor');
          expect(joined.avatar).toBe('💼');

          // Reuse rejected
          await expect(
            run(() =>
              store.upsertGoogleUser({
                email: 'ca2@advisory.in',
                name: 'CA 2',
                googleSub: 'sub-ca-2',
                inviteCode: inv.code,
                emailVerified: true,
              })
            )
          ).rejects.toMatchObject({ code: 'google_invite_invalid' });
        }
      } finally {
        sqliteStore.close();
      }
    });
  });

  describe('HTTP Integration on Node (app.mjs) and Cloudflare Edge ([[path]].js)', () => {
    it('exposes googleOAuthConfigured on /api/health & /api/auth/me and falls back gracefully when unconfigured', async () => {
      const { baseUrl } = await startNodeServer();
      const db = freshD1();

      // Node unconfigured
      const nodeHealth = await fetch(`${baseUrl}/api/health`);
      expect(await nodeHealth.json()).toMatchObject({ ok: true, googleOAuthConfigured: false });
      const nodeMe = await fetch(`${baseUrl}/api/auth/me`);
      expect(await nodeMe.json()).toMatchObject({
        authenticated: false,
        googleOAuthConfigured: false,
      });
      const nodeStart = await fetch(`${baseUrl}/api/auth/google/start`, { redirect: 'manual' });
      expect(nodeStart.status).toBe(302);
      expect(nodeStart.headers.get('location')).toBe('/?authError=google_not_configured');

      // Edge unconfigured
      const edgeHealth = await callEdgeApi(db, '/api/health');
      expect(await edgeHealth.json()).toMatchObject({ ok: true, googleOAuthConfigured: false });
      const edgeMe = await callEdgeApi(db, '/api/auth/me');
      expect(await edgeMe.json()).toMatchObject({
        authenticated: false,
        googleOAuthConfigured: false,
      });
      const edgeStart = await callEdgeApi(db, '/api/auth/google/start');
      expect(edgeStart.status).toBe(302);
      expect(edgeStart.headers.get('location')).toBe(
        'https://hearthledger-7ar.pages.dev/?authError=google_not_configured'
      );
    });

    it('handles configured /start, cancellation, invalid/expired state, and full OAuth login on Node + SQLite', async () => {
      const mockGoogleFetch = createMockGoogleFetch();
      const { baseUrl } = await startNodeServer(OAUTH_ENV, mockGoogleFetch);

      const health = await fetch(`${baseUrl}/api/health`);
      expect(await health.json()).toMatchObject({ ok: true, googleOAuthConfigured: true });

      // Start redirects to Google with verifiable signed state
      const startRes = await fetch(`${baseUrl}/api/auth/google/start?mode=signup&plan=plus`, {
        redirect: 'manual',
      });
      expect(startRes.status).toBe(302);
      const googleUrl = new URL(startRes.headers.get('location') || '');
      expect(googleUrl.origin + googleUrl.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      const state = googleUrl.searchParams.get('state') || '';
      const verifiedState = await verifyGoogleState({
        secret: OAUTH_ENV.SESSION_HMAC_SECRET,
        state,
      });
      expect(verifiedState).toMatchObject({ ok: true, mode: 'signup', nextPlan: 'plus' });

      // Cancellation -> /?authError=google_cancelled
      const cancelRes = await fetch(`${baseUrl}/api/auth/google/callback?error=access_denied`, {
        redirect: 'manual',
      });
      expect(cancelRes.status).toBe(302);
      expect(cancelRes.headers.get('location')).toBe('/?authError=google_cancelled');

      // Tampered state -> /?authError=google_invalid_state
      const badStateRes = await fetch(
        `${baseUrl}/api/auth/google/callback?code=abc&state=tampered.state`,
        { redirect: 'manual' }
      );
      expect(badStateRes.status).toBe(302);
      expect(badStateRes.headers.get('location')).toBe('/?authError=google_invalid_state');

      // Expired state -> /?authError=google_state_expired
      const expiredState = await buildGoogleState({
        secret: OAUTH_ENV.SESSION_HMAC_SECRET,
        ttlMs: -500,
      });
      const expRes = await fetch(
        `${baseUrl}/api/auth/google/callback?code=abc&state=${encodeURIComponent(expiredState)}`,
        { redirect: 'manual' }
      );
      expect(expRes.status).toBe(302);
      expect(expRes.headers.get('location')).toBe('/?authError=google_state_expired');

      // Valid callback with x-forwarded-proto: https sets Secure + HttpOnly + SameSite=Lax cookie
      const cbRes = await fetch(
        `${baseUrl}/api/auth/google/callback?code=auth-code-ok&state=${encodeURIComponent(state)}`,
        {
          redirect: 'manual',
          headers: { 'x-forwarded-proto': 'https, http' },
        }
      );
      expect(cbRes.status).toBe(302);
      expect(cbRes.headers.get('location')).toBe('/?oauth=ok&oauthNew=1&postAuthPlan=plus');
      const setCookie = cbRes.headers.get('set-cookie') || '';
      expect(setCookie).toContain('hl_session=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Secure');

      const cookie = cookieFromResponse(cbRes);
      const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
      expect(await meRes.json()).toMatchObject({
        authenticated: true,
        googleOAuthConfigured: true,
        session: {
          email: 'aarav.patel@example.com',
          name: 'Aarav Patel',
          role: 'admin',
        },
      });

      // Empty-password OAuth account cannot use password login or change-password
      const pwLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'aarav.patel@example.com', password: '' }),
      });
      expect(pwLoginRes.status).toBe(401);

      const changePwRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ currentPassword: '', newPassword: 'new-strong-password' }),
      });
      expect(changePwRes.status).toBe(401);
      expect(await changePwRes.json()).toEqual({ error: 'OAUTH_ACCOUNT_NO_PASSWORD' });
    });

    it('handles full OAuth flow & unverified email rejection on Cloudflare Edge ([[path]].js)', async () => {
      const db = freshD1();

      // Start on Edge
      const startRes = await callEdgeApi(
        db,
        '/api/auth/google/start?mode=signup&plan=advisor',
        {},
        OAUTH_ENV
      );
      expect(startRes.status).toBe(302);
      const authUrl = new URL(startRes.headers.get('location') || '');
      const state = authUrl.searchParams.get('state') || '';

      // Unverified email rejected cleanly with 302 redirect (no 500)
      globalThis.fetch = createMockGoogleFetch({ email_verified: false });
      const unverifiedRes = await callEdgeApi(
        db,
        `/api/auth/google/callback?code=code-unv&state=${encodeURIComponent(state)}`,
        {},
        OAUTH_ENV
      );
      expect(unverifiedRes.status).toBe(302);
      expect(unverifiedRes.headers.get('location')).toBe(
        'https://hearthledger-7ar.pages.dev/?authError=google_email_unverified'
      );

      // Valid verified Google user sets hl_session cookie and authenticates /api/auth/me
      globalThis.fetch = createMockGoogleFetch();
      const cbRes = await callEdgeApi(
        db,
        `/api/auth/google/callback?code=code-ok&state=${encodeURIComponent(state)}`,
        {},
        OAUTH_ENV
      );
      expect(cbRes.status).toBe(302);
      expect(cbRes.headers.get('location')).toBe(
        'https://hearthledger-7ar.pages.dev/?oauth=ok&oauthNew=1&postAuthPlan=advisor'
      );
      const setCookie = cbRes.headers.get('set-cookie') || '';
      expect(setCookie).toContain('hl_session=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Secure');

      const cookie = cookieFromResponse(cbRes);
      const meRes = await callEdgeApi(
        db,
        '/api/auth/me',
        { headers: { Cookie: cookie } },
        OAUTH_ENV
      );
      expect(await meRes.json()).toMatchObject({
        authenticated: true,
        googleOAuthConfigured: true,
        session: {
          email: 'aarav.patel@example.com',
          name: 'Aarav Patel',
          role: 'admin',
        },
      });
    });

    it('enforces 429 rate limiting on /api/auth/google/start in [[path]].js', async () => {
      const db = freshD1();
      const isolatedIp = '203.0.113.42';

      for (let i = 0; i < 30; i += 1) {
        const res = await callEdgeApi(
          db,
          '/api/auth/google/start',
          { headers: { 'cf-connecting-ip': isolatedIp } },
          { ...OAUTH_ENV, DISABLE_RATE_LIMIT: 'false' }
        );
        expect(res.status).toBe(302);
      }

      const limitedRes = await callEdgeApi(
        db,
        '/api/auth/google/start',
        { headers: { 'cf-connecting-ip': isolatedIp } },
        { ...OAUTH_ENV, DISABLE_RATE_LIMIT: 'false' }
      );
      expect(limitedRes.status).toBe(429);
      expect(await limitedRes.json()).toEqual({ error: 'RATE_LIMITED' });
    });
  });
});
