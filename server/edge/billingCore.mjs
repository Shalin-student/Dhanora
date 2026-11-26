export const PLAN_CATALOG = {
  plus: {
    tier: 'plus',
    name: 'Family Plus',
    INR: { monthly: 100, yearly: 100 },
    USD: { monthly: 250, yearly: 1500 },
  },
  advisor: {
    tier: 'advisor',
    name: 'Advisor Practice',
    INR: { monthly: 200, yearly: 200 },
    USD: { monthly: 800, yearly: 7900 },
  },
};

export function getPlanPriceMinor(tier, currency, billingCycle) {
  const plan = PLAN_CATALOG[tier];
  if (!plan) return null;
  const cur = currency === 'USD' ? 'USD' : 'INR';
  const cycle = billingCycle === 'monthly' ? 'monthly' : 'yearly';
  return {
    tier,
    planName: plan.name,
    currency: cur,
    billingCycle: cycle,
    amountMinor: plan[cur][cycle],
  };
}

export function bytesToHex(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function randomHex(byteCount = 16) {
  const bytes = new Uint8Array(byteCount);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function safeHexEqual(expectedHex, providedHex) {
  if (!expectedHex || !providedHex || typeof providedHex !== 'string') return false;
  const a = String(expectedHex).trim().toLowerCase();
  const b = String(providedHex).trim().toLowerCase();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function sha256Hex(payload) {
  const encoded = new TextEncoder().encode(String(payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(digest));
}

export async function computeHmacHexWeb(payload, secret) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(String(payload)));
  return bytesToHex(new Uint8Array(sigBuf));
}

export async function verifyRazorpayPaymentSignatureWeb({ orderId, paymentId, signature, secret }) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = await computeHmacHexWeb(`${orderId}|${paymentId}`, secret);
  return safeHexEqual(expected, signature);
}

export async function verifyRazorpayWebhookSignatureWeb({ rawBody, signature, secret }) {
  if (!rawBody || !signature || !secret) return false;
  const expected = await computeHmacHexWeb(rawBody, secret);
  return safeHexEqual(expected, signature);
}

export async function verifyStripeWebhookSignatureWeb({
  rawBody,
  signatureHeader,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
}) {
  if (!rawBody || !signatureHeader || !secret) return false;
  const parts = String(signatureHeader)
    .split(',')
    .map((p) => p.trim());
  let timestamp = null;
  const signatures = [];
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = Number(v);
    if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || !Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = await computeHmacHexWeb(`${timestamp}.${rawBody}`, secret);
  return signatures.some((sig) => safeHexEqual(expected, sig));
}

export function computePlanExpiryIso(billingCycle, fromDate = new Date()) {
  const days = billingCycle === 'monthly' ? 31 : 366;
  return new Date(fromDate.getTime() + days * 86400000).toISOString().slice(0, 10);
}

function toBase64(text) {
  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  return Buffer.from(text, 'utf8').toString('base64');
}

export async function createGatewayCheckout({
  householdId,
  userEmail,
  tier,
  billingCycle,
  currency,
  gstNumber,
  baseUrl,
  env = {},
}) {
  const pricing = getPlanPriceMinor(tier, currency, billingCycle);
  if (!pricing) {
    throw Object.assign(new Error('INVALID_PLAN_TIER'), { statusCode: 400 });
  }

  // INR -> Razorpay Order API
  if (pricing.currency === 'INR' && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const auth = toBase64(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
    const receipt = `hl_${householdId.slice(0, 12)}_${Date.now()}`;
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: pricing.amountMinor,
        currency: 'INR',
        receipt,
        notes: {
          householdId,
          tier,
          billingCycle: pricing.billingCycle,
          gstNumber: gstNumber || '',
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error?.description || 'RAZORPAY_ORDER_FAILED'), {
        statusCode: 502,
      });
    }
    return {
      provider: 'razorpay',
      mode: 'live',
      keyId: env.RAZORPAY_KEY_ID,
      orderId: data.id,
      amountMinor: pricing.amountMinor,
      currency: 'INR',
      tier,
      billingCycle: pricing.billingCycle,
      planName: pricing.planName,
    };
  }

  // USD -> Stripe Checkout Session API
  if (pricing.currency === 'USD' && env.STRIPE_SECRET_KEY) {
    const cleanBase = (baseUrl || 'http://localhost:4174').replace(/\/+$/, '');
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', `${cleanBase}/pricing?checkout=success&tier=${encodeURIComponent(tier)}`);
    form.set('cancel_url', `${cleanBase}/pricing?checkout=canceled`);
    form.set('client_reference_id', householdId);
    if (userEmail) form.set('customer_email', userEmail);
    form.set('metadata[householdId]', householdId);
    form.set('metadata[tier]', tier);
    form.set('metadata[billingCycle]', pricing.billingCycle);
    form.set('metadata[currency]', 'USD');
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', 'usd');
    form.set('line_items[0][price_data][unit_amount]', String(pricing.amountMinor));
    form.set(
      'line_items[0][price_data][product_data][name]',
      `HearthLedger ${pricing.planName} (${pricing.billingCycle})`
    );

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw Object.assign(new Error(data?.error?.message || 'STRIPE_SESSION_FAILED'), {
        statusCode: 502,
      });
    }
    return {
      provider: 'stripe',
      mode: 'live',
      sessionId: data.id,
      checkoutUrl: data.url,
      amountMinor: pricing.amountMinor,
      currency: 'USD',
      tier,
      billingCycle: pricing.billingCycle,
      planName: pricing.planName,
    };
  }

  const allowSandbox =
    env.ALLOW_TEST_BILLING === 'true' ||
    (env.NODE_ENV !== 'production' && env.ALLOW_TEST_BILLING !== 'false');

  if (!allowSandbox) {
    throw Object.assign(new Error('BILLING_KEYS_NOT_CONFIGURED'), { statusCode: 503 });
  }

  return {
    provider: pricing.currency === 'INR' ? 'razorpay' : 'stripe',
    mode: 'sandbox',
    orderId: `ord_sandbox_${Date.now()}_${randomHex(3)}`,
    amountMinor: pricing.amountMinor,
    currency: pricing.currency,
    tier,
    billingCycle: pricing.billingCycle,
    planName: pricing.planName,
  };
}
