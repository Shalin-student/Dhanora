import crypto from 'node:crypto';

export const PLAN_CATALOG = {
  plus: {
    tier: 'plus',
    name: 'Family Plus',
    INR: { monthly: 14900, yearly: 79900 },
    USD: { monthly: 250, yearly: 1500 },
  },
  advisor: {
    tier: 'advisor',
    name: 'Advisor Practice',
    INR: { monthly: 49900, yearly: 499900 },
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

function safeHexEqual(expectedHex, providedHex) {
  if (!expectedHex || !providedHex || typeof providedHex !== 'string') return false;
  const a = Buffer.from(String(expectedHex).trim().toLowerCase(), 'utf8');
  const b = Buffer.from(String(providedHex).trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function computeHmacHex(payload, secret) {
  return crypto.createHmac('sha256', String(secret)).update(payload).digest('hex');
}

export function verifyRazorpayPaymentSignature({ orderId, paymentId, signature, secret }) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = computeHmacHex(`${orderId}|${paymentId}`, secret);
  return safeHexEqual(expected, signature);
}

export function verifyRazorpayWebhookSignature({ rawBody, signature, secret }) {
  if (!rawBody || !signature || !secret) return false;
  const expected = computeHmacHex(rawBody, secret);
  return safeHexEqual(expected, signature);
}

export function verifyStripeWebhookSignature({
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

  const expected = computeHmacHex(`${timestamp}.${rawBody}`, secret);
  return signatures.some((sig) => safeHexEqual(expected, sig));
}

export function computePlanExpiryIso(billingCycle, fromDate = new Date()) {
  const days = billingCycle === 'monthly' ? 31 : 366;
  return new Date(fromDate.getTime() + days * 86400000).toISOString().slice(0, 10);
}

export async function createGatewayCheckout({
  householdId,
  userEmail,
  tier,
  billingCycle,
  currency,
  gstNumber,
  baseUrl,
  env = process.env,
}) {
  const pricing = getPlanPriceMinor(tier, currency, billingCycle);
  if (!pricing) {
    throw Object.assign(new Error('INVALID_PLAN_TIER'), { statusCode: 400 });
  }

  // INR -> Razorpay Order API
  if (pricing.currency === 'INR' && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
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

  // Sandbox / Test mode when keys aren't set yet (allowed outside strict prod unless ALLOW_TEST_BILLING=true)
  const allowSandbox =
    env.ALLOW_TEST_BILLING === 'true' ||
    (env.NODE_ENV !== 'production' && env.ALLOW_TEST_BILLING !== 'false');

  if (!allowSandbox) {
    throw Object.assign(new Error('BILLING_KEYS_NOT_CONFIGURED'), { statusCode: 503 });
  }

  return {
    provider: pricing.currency === 'INR' ? 'razorpay' : 'stripe',
    mode: 'sandbox',
    orderId: `ord_sandbox_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    amountMinor: pricing.amountMinor,
    currency: pricing.currency,
    tier,
    billingCycle: pricing.billingCycle,
    planName: pricing.planName,
  };
}
