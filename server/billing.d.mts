export function computeHmacHex(payload: string, secret: string): string;
export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean;
export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signature: string;
  secret: string;
}): boolean;
export function verifyStripeWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean;
