# Production Launch & Google Search Console Guide

## 1. Environment Variables
Copy `.env.example` to `.env` (or configure secrets in Render / Fly.io / Docker host):
- Set `APP_BASE_URL=https://yourdomain.com`
- Set `REQUIRE_AUTH_FOR_SYNC=true`
- Set `ALLOW_TEST_BILLING=false` (once Razorpay/Stripe merchant keys are configured)

## 2. Cloud Hosting Options
### Option A — Docker / VPS (`docker-compose up -d --build`)
Runs Node 22 on port `4174` behind Nginx/Caddy TLS with `/data/hearthledger.db` mounted on persistent storage.

### Option B — Render (`render.yaml`)
Push the repository to GitHub/GitLab and select **New -> Blueprint** pointing to `render.yaml` (includes a 5 GB persistent `/data` SSD disk).

### Option C — Fly.io (`fly.toml`)
```sh
fly volumes create hearthledger_data --region bom --size 5
fly secrets set APP_BASE_URL=https://yourdomain.com RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=...
fly deploy
```

## 3. Payment Gateway Webhooks
- **Razorpay (INR / UPI)**: Point webhook URL to `https://yourdomain.com/api/webhooks/razorpay` with events `payment.captured` and `order.paid`.
- **Stripe (USD)**: Point webhook URL to `https://yourdomain.com/api/webhooks/stripe` with events `checkout.session.completed` and `customer.subscription.deleted`.

## 4. Publish to Google Search
1. Deploy over HTTPS on your custom domain.
2. Open Google Search Console -> **Add Property** (`URL prefix` or `Domain`).
3. Choose **HTML tag** verification, copy the token into `GOOGLE_SITE_VERIFICATION` env var, and redeploy/restart (the server injects `<meta name="google-site-verification" ...>` and `<link rel="canonical" ...>` automatically).
4. Submit `https://yourdomain.com/sitemap.xml` inside **Indexing -> Sitemaps**.
5. Schedule automated SQLite backups via `node scripts/backup-sqlite.mjs`.
