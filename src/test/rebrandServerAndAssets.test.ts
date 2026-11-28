// @vitest-environment node
// @ts-expect-error Node built-in without @types/node in tsconfig
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Untyped ESM edge module
import { buildFeedbackAlertEmail, buildInviteEmail, buildPasswordResetEmail, buildReceiptEmail } from '../../server/edge/emailCore.mjs';
// @ts-expect-error Untyped ESM edge module
import { createGatewayCheckout, getPlanPriceMinor } from '../../server/edge/billingCore.mjs';

const workspaceUrl = (relPath: string) => new URL(`../../${relPath}`, import.meta.url);

describe('M2 Server Emails, Stripe Product Name & Public Assets', () => {
  it('uses Dhanora (ધનોરા) in transactional emails and Stripe checkout while preserving ₹1/₹2 pricing', async () => {
    const reset = buildPasswordResetEmail({
      name: 'Aarav',
      resetUrl: 'https://example.com/?token=abc',
    });
    expect(reset.subject).toContain('Dhanora (ધનોરા)');
    expect(reset.subject).not.toMatch(/HearthLedger/i);
    expect(reset.html).toContain('Dhanora (ધનોરા)');
    expect(reset.html).toContain('token=abc');
    expect(reset.html).not.toMatch(/HearthLedger/i);

    const invite = buildInviteEmail({
      householdName: 'Patel Family',
      role: 'partner',
      inviteUrl: 'https://example.com/invite?code=123',
    });
    expect(invite.subject).toContain('Dhanora (ધનોરા)');
    expect(invite.html).not.toMatch(/HearthLedger/i);

    const receipt = buildReceiptEmail({
      householdName: 'Patel Family',
      planName: 'Family Plus',
      billingCycle: 'yearly',
      amountDisplay: '₹1',
      paymentId: 'pay_1',
    });
    expect(receipt.subject).toContain('Dhanora (ધનોરા)');
    expect(receipt.html).toContain('Dhanora (ધનોરા)');

    const fb = buildFeedbackAlertEmail({
      userName: 'Aarav',
      userEmail: 'a@example.com',
      category: 'feature',
      message: 'Nice!',
      pageView: 'dashboard',
    });
    expect(fb.subject).toContain('Dhanora (ધનોરા)');

    expect(getPlanPriceMinor('plus', 'INR', 'yearly')?.amountMinor).toBe(100);
    expect(getPlanPriceMinor('advisor', 'INR', 'yearly')?.amountMinor).toBe(200);

    const originalFetch = globalThis.fetch;
    let capturedBody = '';
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = String(init?.body || '');
      return new Response(
        JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as typeof fetch;

    try {
      await createGatewayCheckout({
        householdId: 'hh-1',
        userEmail: 'a@example.com',
        tier: 'plus',
        billingCycle: 'yearly',
        currency: 'USD',
        baseUrl: 'https://hearthledger-7ar.pages.dev',
        env: { STRIPE_SECRET_KEY: 'sk_test_123' },
      });
      const params = new URLSearchParams(capturedBody);
      expect(params.get('line_items[0][price_data][product_data][name]')).toContain(
        'Dhanora (ધનોરા)'
      );
      expect(params.get('line_items[0][price_data][product_data][name]')).not.toMatch(
        /HearthLedger/i
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('ships compliant index.html, manifest.webmanifest, sw.js, and WDW raster/SVG assets', () => {
    const html = fs.readFileSync(workspaceUrl('index.html'), 'utf8') as string;
    expect(html).toContain('Dhanora (ધનોરા)');
    expect(html).not.toMatch(/HearthLedger/i);
    expect(html).toContain('/favicon.ico');
    expect(html).toContain('/icons/icon.svg');
    expect(html).toContain('/icons/icon-96.png');
    expect(html).toContain('/icons/icon-192.png');
    expect(html).toContain('/icons/apple-touch-icon.png');
    expect(html).toContain('/twitter-image.png');
    expect(html).toContain('content="1200"');
    expect(html).toContain('content="630"');

    const manifest = JSON.parse(
      fs.readFileSync(workspaceUrl('public/manifest.webmanifest'), 'utf8') as string
    );
    expect(manifest.name).toContain('Dhanora (ધનોરા)');
    expect(manifest.short_name).toBe('Dhanora (ધનોરા)');
    expect(manifest.background_color).toBe('#faf8ff');
    expect(manifest.theme_color).toBe('#003527');
    expect(JSON.stringify(manifest)).not.toMatch(/HearthLedger/i);

    const sw = fs.readFileSync(workspaceUrl('public/sw.js'), 'utf8') as string;
    expect(sw).toContain('dhanora-cache-v3');
    expect(sw).not.toMatch(/hearthledger/i);

    const requiredAssets = [
      'public/favicon.ico',
      'public/og-image.png',
      'public/twitter-image.png',
      'public/icons/icon.svg',
      'public/icons/icon-96.png',
      'public/icons/icon-192.png',
      'public/icons/icon-512.png',
      'public/icons/icon-512-maskable.png',
      'public/icons/apple-touch-icon.png',
    ];
    for (const rel of requiredAssets) {
      const url = workspaceUrl(rel);
      expect(fs.existsSync(url), `Missing asset ${rel}`).toBe(true);
      expect(fs.statSync(url).size, `Empty asset ${rel}`).toBeGreaterThan(0);
    }
    expect(fs.statSync(workspaceUrl('public/og-image.png')).size).toBeLessThanOrEqual(120 * 1024);
    expect(fs.statSync(workspaceUrl('public/twitter-image.png')).size).toBeLessThanOrEqual(
      120 * 1024
    );
    expect(fs.statSync(workspaceUrl('public/icons/icon.svg')).size).toBeLessThanOrEqual(2 * 1024);
  });
});
