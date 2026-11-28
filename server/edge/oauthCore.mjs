const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const BASE64URL_RE = /^[A-Za-z0-9\-_]+$/;

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input) {
  if (typeof input !== 'string' || !input || !BASE64URL_RE.test(input)) {
    throw new Error('INVALID_BASE64URL');
  }
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret, usage) {
  return globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

function sanitizeMode(mode) {
  return mode === 'signup' ? 'signup' : 'signin';
}

function sanitizeInviteCode(inviteCode) {
  return String(inviteCode ?? '').trim().slice(0, 64);
}

function sanitizePlan(nextPlan) {
  return nextPlan === 'plus' || nextPlan === 'advisor' ? nextPlan : '';
}

export async function buildGoogleState({
  secret,
  mode = 'signin',
  inviteCode = '',
  nextPlan = '',
  ttlMs = 600_000,
}) {
  if (typeof secret !== 'string' || !secret.trim()) {
    throw new Error('OAUTH_STATE_SECRET_MISSING');
  }
  const now = Date.now();
  const effectiveTtl = Number.isFinite(Number(ttlMs)) ? Number(ttlMs) : 600_000;
  const nonceBytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(nonceBytes);

  const payload = {
    mode: sanitizeMode(mode),
    inviteCode: sanitizeInviteCode(inviteCode),
    nextPlan: sanitizePlan(nextPlan),
    nonce: bytesToBase64Url(nonceBytes),
    iat: now,
    exp: now + effectiveTtl,
  };

  const payloadB64 = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret, 'sign');
  const sigBuf = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(payloadB64)
  );
  const sigB64 = bytesToBase64Url(new Uint8Array(sigBuf));
  return `${payloadB64}.${sigB64}`;
}

export async function verifyGoogleState({ secret, state }) {
  if (typeof secret !== 'string' || !secret.trim()) {
    return { ok: false, error: 'google_invalid_state' };
  }
  if (typeof state !== 'string' || !state) {
    return { ok: false, error: 'google_invalid_state' };
  }
  const parts = state.split('.');
  if (parts.length !== 2) {
    return { ok: false, error: 'google_invalid_state' };
  }
  const [payloadB64, sigB64] = parts;
  if (!BASE64URL_RE.test(payloadB64) || !BASE64URL_RE.test(sigB64)) {
    return { ok: false, error: 'google_invalid_state' };
  }

  let sigBytes;
  try {
    sigBytes = base64UrlToBytes(sigB64);
  } catch {
    return { ok: false, error: 'google_invalid_state' };
  }

  try {
    const key = await importHmacKey(secret, 'verify');
    const valid = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      textEncoder.encode(payloadB64)
    );
    if (!valid) {
      return { ok: false, error: 'google_invalid_state' };
    }
  } catch {
    return { ok: false, error: 'google_invalid_state' };
  }

  let payload;
  try {
    const payloadBytes = base64UrlToBytes(payloadB64);
    payload = JSON.parse(textDecoder.decode(payloadBytes));
  } catch {
    return { ok: false, error: 'google_invalid_state' };
  }

  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'google_invalid_state' };
  }

  const now = Date.now();
  if (!Number.isFinite(payload.exp)) {
    return { ok: false, error: 'google_invalid_state' };
  }
  if (now > payload.exp) {
    return { ok: false, error: 'google_state_expired' };
  }
  if (!Number.isFinite(payload.iat) || payload.iat > now + 60_000) {
    return { ok: false, error: 'google_invalid_state' };
  }

  return {
    ok: true,
    mode: sanitizeMode(payload.mode),
    inviteCode: sanitizeInviteCode(payload.inviteCode),
    nextPlan: sanitizePlan(payload.nextPlan),
    iat: payload.iat,
    exp: payload.exp,
  };
}

export function buildGoogleAuthorizeUrl({ clientId, redirectUri, state }) {
  if (!clientId || !redirectUri || !state) {
    throw new Error('GOOGLE_OAUTH_PARAMS_MISSING');
  }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', String(clientId));
  url.searchParams.set('redirect_uri', String(redirectUri));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', String(state));
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('access_type', 'online');
  return url.toString();
}

export async function exchangeGoogleCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = fetch,
}) {
  if (!code || !clientId || !clientSecret || !redirectUri) {
    throw Object.assign(new Error('Missing required OAuth exchange parameters'), {
      code: 'google_token_exchange_failed',
    });
  }

  const form = new URLSearchParams({
    code: String(code),
    client_id: String(clientId),
    client_secret: String(clientSecret),
    redirect_uri: String(redirectUri),
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!tokenRes.ok) {
    throw Object.assign(new Error(`Google token endpoint returned HTTP ${tokenRes.status}`), {
      code: 'google_token_exchange_failed',
    });
  }

  let tokenData;
  try {
    tokenData = await tokenRes.json();
  } catch {
    throw Object.assign(new Error('Google token endpoint returned invalid JSON'), {
      code: 'google_token_exchange_failed',
    });
  }

  if (!tokenData || typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
    throw Object.assign(new Error('Google token response missing access_token'), {
      code: 'google_token_exchange_failed',
    });
  }

  const userRes = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userRes.ok) {
    throw Object.assign(new Error(`Google userinfo endpoint returned HTTP ${userRes.status}`), {
      code: 'google_token_exchange_failed',
    });
  }

  let profile;
  try {
    profile = await userRes.json();
  } catch {
    throw Object.assign(new Error('Google userinfo endpoint returned invalid JSON'), {
      code: 'google_token_exchange_failed',
    });
  }

  const sub = String(profile?.sub ?? '').trim();
  const email = String(profile?.email ?? '').trim().toLowerCase();
  if (!sub || !email || !email.includes('@')) {
    throw Object.assign(new Error('Google userinfo response missing sub or email'), {
      code: 'google_token_exchange_failed',
    });
  }

  const name = String(profile?.name ?? '').trim() || email.split('@')[0];
  const picture = typeof profile?.picture === 'string' ? profile.picture : '';
  const emailVerified = profile?.email_verified === true || profile?.email_verified === 'true';

  return {
    sub,
    email,
    email_verified: emailVerified,
    name,
    picture,
  };
}
