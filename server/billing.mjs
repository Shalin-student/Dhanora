import crypto from 'node:crypto';
import { safeHexEqual } from './edge/billingCore.mjs';
export {
  PLAN_CATALOG,
  DEFAULT_PROMO_CODES,
  computePlanExpiryIso,
  createGatewayCheckout,
  getPlanPriceMinor,
  resolvePromoDiscount,
} from './edge/billingCore.mjs';

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
