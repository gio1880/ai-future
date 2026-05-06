# Payments Setup — Summer Camp + Code Lab Membership

The AI Future site now supports two paid products:

- **Summer Camp 2026** — multi-select weekly registration, $500/week early-bird (until **June 15, 2026**), $550/week thereafter.
- **Code Lab Membership** — $14.99/month or $99.99/year (44% annual savings).

Both run through **Stripe Checkout**. On successful payment, a Stripe webhook fires and the server:

1. Records the payment in `code-lab/data/payments.json`.
2. Sends a branded confirmation email via **Resend**.
3. (Optional) Appends the registration row to a **Google Sheet**.
4. Shows the admin the order at `/payments-admin` (Basic Auth).

Everything is implemented as ordinary Express routes on the existing server — no separate serverless functions required. The backend module is `payments.js` at the project root.

---

## 1. Platform Note

The original brief mentioned *Netlify Functions or Vercel*, but this site is an **Express app deployed on Render** (see `render.yaml` and `server.js`). Rather than adding a second deploy target, we keep all payment endpoints inside the existing Express app. This is the "matching serverless format" for this codebase: the routes hot-reload with the rest of the server, share the same Render Disk for data persistence, and need only the new environment variables below.

If you ever migrate to Netlify/Vercel functions, `payments.js` is written so each handler (`handleCreateCheckout`, `handleWebhook`, `handleList`, `handleExport`, `handleSessionLookup`, `handlePricing`) is a pure `(req, res)` function and can be moved into `netlify/functions/*.js` or `api/*.js` with minimal changes.

---

## 2. Environment Variables

Copy `.env.example` to `.env` for local dev (or set the same keys in the Render dashboard).

| Variable | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | `sk_test_…` in staging, `sk_live_…` in production. |
| `STRIPE_WEBHOOK_SECRET` | yes | The `whsec_…` secret Stripe prints when you create the webhook endpoint. |
| `STRIPE_CODELAB_MONTHLY_PRICE_ID` | optional | If set, Code Lab monthly becomes a true recurring **subscription**. If unset, it is a one-time $14.99 charge. |
| `STRIPE_CODELAB_ANNUAL_PRICE_ID` | optional | Same idea for annual. |
| `SITE_BASE_URL` | recommended | Public URL used by Stripe to redirect on success/cancel (e.g. `https://aifuture.com`). |
| `RESEND_API_KEY` | recommended | Enables confirmation emails. Without it, the server skips email silently. |
| `RESEND_FROM_EMAIL` | optional | Defaults to `AI Future <no-reply@aifuture.com>`. Must be a verified Resend sending address. |
| `GOOGLE_SHEETS_ID` | optional | Spreadsheet ID to mirror registrations into. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | optional | Full JSON of a Google service-account key. |
| `GOOGLE_SHEETS_RANGE` | optional | Defaults to `Registrations!A:K`. |
| `PAYMENTS_ADMIN_USER` / `PAYMENTS_ADMIN_PASSWORD` | yes | Basic-auth credentials for `/payments-admin`. |

---

## 3. Stripe Setup

1. Create a Stripe account at <https://dashboard.stripe.com>.
2. **API keys** (Developers → API keys) — copy the **Secret key** into `STRIPE_SECRET_KEY`. Start with **test mode** for verification.
3. **Optional: Code Lab Products** (for real subscriptions):
   - Products → **+ Add product** → name "Code Lab Membership".
   - Add two **recurring** prices: `$14.99/month` and `$99.99/year`.
   - Copy each Price ID (`price_...`) into `STRIPE_CODELAB_MONTHLY_PRICE_ID` and `STRIPE_CODELAB_ANNUAL_PRICE_ID`.
   - If you skip this step, the "Subscribe" button still works — Stripe will charge once at the same price.
4. **Webhook endpoint** (Developers → Webhooks → **+ Add endpoint**):
   - Endpoint URL: `https://YOUR-DOMAIN/api/webhook`
   - Events to send: `checkout.session.completed` (that's the only one the server uses today).
   - Click the endpoint → reveal the **Signing secret** (`whsec_...`) → put it in `STRIPE_WEBHOOK_SECRET`.
5. **Local testing** — run the Stripe CLI to forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook
   ```
   The CLI prints a temporary `whsec_...` you can paste into your local `.env`.

---

## 4. Resend Setup

1. Sign up at <https://resend.com>.
2. **Domains** → add and verify a domain you own (e.g. `aifuture.com`). This is required for production sending.
3. **API Keys** → create a new key → copy into `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL` to an address on the verified domain (e.g. `AI Future <no-reply@aifuture.com>`).

If `RESEND_API_KEY` is missing, the server logs a warning but **does not fail the checkout**. Payments still record; you just won't get an automatic email.

---

## 5. Google Sheets Setup (optional)

1. Create a Google Sheet. Recommended columns in row 1:
   ```
   Timestamp | Product | Parent | Child | Age | Grade | Email | Phone | Plan/Weeks | Amount | Stripe Session
   ```
2. Google Cloud Console (<https://console.cloud.google.com>):
   - Create or pick a project.
   - **APIs & Services → Library** → enable **Google Sheets API**.
   - **IAM & Admin → Service Accounts** → Create. Grant it no project-level roles.
   - Open the service account → **Keys → Add key → JSON** → download.
3. Copy the sheet ID from the URL (`https://docs.google.com/spreadsheets/d/SHEET_ID/edit`) into `GOOGLE_SHEETS_ID`.
4. Share the sheet with the service-account email (shown on the Service Account page) — grant **Editor**.
5. Paste the downloaded JSON file's **contents** (as one line, escaped for your `.env` / Render dashboard) into `GOOGLE_SERVICE_ACCOUNT_JSON`.
6. Leave `GOOGLE_SHEETS_RANGE` unset unless your sheet tab isn't named "Registrations".

If Sheets vars are missing, the server skips the sheet-append silently; payments still record locally.

---

## 6. Deployment on Render

`server.js` already wires `payments.mount(app, express)` at the right place — no code changes needed on deploy. Before pushing:

1. In Render **→ Environment**, add all the variables from section 2 above. Use `sync: false` so values aren't leaked into `render.yaml`.
2. Trigger a deploy (Render rebuilds `npm install` which pulls in `stripe`).
3. Test with a Stripe test card: `4242 4242 4242 4242`, any future date, any CVC, any ZIP.
4. Confirm:
   - The browser lands on `/confirmation.html?session_id=cs_test_...`.
   - Visit `/payments-admin` (log in with `PAYMENTS_ADMIN_USER` / `PAYMENTS_ADMIN_PASSWORD`) — the row appears.
   - The parent's inbox receives the Resend email.
   - The Google Sheet receives a new row.
5. Switch Stripe to live mode: replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with live values, redeploy, test with a real card.

---

## 7. Admin Dashboard

- URL: `https://YOUR-DOMAIN/payments-admin`
- Protected by HTTP Basic Auth (`PAYMENTS_ADMIN_USER` / `PAYMENTS_ADMIN_PASSWORD`).
- Features:
  - Summary stats (total orders, camp vs Code Lab, revenue).
  - Filter by product, search by name/email.
  - Download CSV or JSON (`/api/payments/export?format=csv|json`).
- Storage: plain JSON at `code-lab/data/payments.json`. On Render this lives on the mounted disk (`DATA_DIR`), so the file persists across deploys.

---

## 8. API Reference

All routes are mounted by `payments.mount(app, express)` in `server.js`. They are registered **before** the global `express.json()` so the webhook sees raw bytes.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/create-checkout` | public | Creates a Stripe Checkout Session. Accepts `{ product: "camp" \| "codelab", ... }`. |
| `POST` | `/api/webhook` | Stripe signature | Handles `checkout.session.completed`. |
| `GET` | `/api/payments/pricing` | public | Current camp pricing + early-bird flag. Used by the front-end. |
| `GET` | `/api/payments/session?id=cs_…` | public | Lookup a completed order for the confirmation page. |
| `GET` | `/api/payments/list` | Basic Auth | All recorded payments (admin UI). |
| `GET` | `/api/payments/export?format=csv\|json` | Basic Auth | Download all payments. |
| `GET` | `/payments-admin` | Basic Auth | The admin HTML page. |

---

## 9. Troubleshooting

- **"Stripe not configured"** — set `STRIPE_SECRET_KEY` and restart.
- **Webhook signature failures** — usually means `STRIPE_WEBHOOK_SECRET` doesn't match the endpoint's signing secret. Fetch it again from the Stripe Dashboard → Webhooks.
- **Email not arriving** — check `RESEND_API_KEY`, make sure your sending domain is verified, and inspect server logs (Render → Logs) for `Resend email error`.
- **Sheet not updating** — the service account must have **Editor** access to the sheet, and `GOOGLE_SHEETS_ID` must be the sheet ID (the long string in the URL), not the whole URL.
- **Prices look wrong on the page** — the front-end first calls `/api/payments/pricing`. If that endpoint is unreachable, it falls back to hard-coded defaults. Edit `PRICING` in `payments.js` if you change the published prices.
