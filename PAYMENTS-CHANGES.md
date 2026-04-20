# Payments Integration — Change Manifest

Everything you need to review, commit, and deploy the Summer Camp + Code Lab membership payment system. No files elsewhere were redesigned; existing sections kept their styles intact.

## Files Added

| Path | Purpose |
|---|---|
| `payments.js` | Express payment module (Stripe Checkout, webhook, Resend email, Google Sheets append, admin list/export). Exports `mount(app, express)`. |
| `confirmation.html` | Success page Stripe redirects to after checkout. Reads `?session_id=` and calls `/api/payments/session` to show order summary. Styled with existing design tokens. |
| `payments-admin.html` | Admin dashboard at `/payments-admin`. Stats, filters, search, CSV/JSON download, protected by Basic Auth. |
| `PAYMENTS.md` | Full setup guide — Stripe, Resend, Google Sheets, deployment, env vars, API reference, troubleshooting. |
| `PAYMENTS-CHANGES.md` | This file. |

## Files Edited

1. **`package.json`** — added `"stripe": "^14.25.0"` to dependencies. Run `npm install` before first boot.

2. **`server.js`** — two small additions:
   - `const payments = require('./payments');` at the top with the other requires.
   - `payments.mount(app, express);` inserted **before** `app.use(express.json())`. This ordering matters: the Stripe webhook endpoint needs the raw request body to verify signatures.

3. **`.env.example`** — documented new env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `PAYMENTS_ADMIN_USER`, `PAYMENTS_ADMIN_PASSWORD`, and optional `SITE_BASE_URL`, `STRIPE_CODELAB_*_PRICE_ID`, `GOOGLE_SHEETS_RANGE`).

4. **`index.html`** — appended a new `<section class="section summer-register-section" id="summer-register">` **immediately after** the existing `#summer-camp` section (was line 522, before `<!-- Student Moments -->`). The block contains:
   - Navy/yellow price banner with tag, amount, and live countdown to June 15 2026.
   - 9-week selectable calendar grid wired to `/api/payments/pricing`.
   - Running total footer.
   - Camper info form (parent name, child name, age, grade, email, phone).
   - "Register & Pay" button that POSTs to `/api/create-checkout` and redirects to Stripe.
   - Scoped `<style>` block using existing CSS custom properties (`--af-navy`, `--af-yellow`, `--af-cream`, etc.). Zero global CSS changes.
   - Scoped `<script>` block. No dependencies outside the page.

5. **`code-lab/code-lab.html`** — inserted a new `<section class="section cl-membership-section" id="membership">` **immediately before** the existing `.cta-section` (was line 665). Contains:
   - Monthly/Annual toggle with "Save 44%" badge.
   - Navy-gradient plan-feature card (6 feature checks).
   - Subscribe form (parent name, student name, age, grade, email).
   - Same checkout flow, POST to `/api/create-checkout` with `product: "codelab"`.
   - Scoped `<style>` + `<script>` blocks.

## Files Unchanged

No other HTML, CSS, JS, or config was touched. The existing homepage hero, pathways grid, summer camp marketing section, student gallery, summer-inquiry form, Code Lab landing hero, feature grids, CTA section, footer, and design system CSS are all intact.

## Design System Reuse

The new UI reads from these existing tokens (no new colors, fonts, or spacing values invented):

- Colors: `--af-navy`, `--af-deep-navy`, `--af-yellow`, `--af-cream`, `--af-white`, `--af-slate`, `--af-muted`, `--af-border`.
- Fonts: Inter (body), Cinzel (headings) — already loaded by the page's `<head>`.
- Radii/shadows: `--r-md`, `--r-lg`, `--r-xl`, `--r-full`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`.
- Buttons: `.btn`, `.btn--primary`, `.btn--outline`, `.btn--lg`, `.btn--sm` — all pre-existing classes.

## Routes Added

All mounted inside `payments.mount(app, express)`:

```
POST /api/create-checkout
POST /api/webhook                 (raw-body, Stripe signature verified)
GET  /api/payments/pricing        (public — used by the front-end calendar)
GET  /api/payments/session?id=…   (public — used by /confirmation.html)
GET  /api/payments/list           (Basic Auth)
GET  /api/payments/export         (Basic Auth, ?format=csv|json)
GET  /payments-admin              (Basic Auth, serves payments-admin.html)
```

Because `payments.mount` runs before `app.use(express.json())`, the webhook route registers its own `express.raw({ type: 'application/json' })` parser and the rest of the app keeps normal JSON behavior.

## Data Storage

- New file: `code-lab/data/payments.json` — JSON array of payment records. Created on first write.
- On Render, `code-lab/data/` lives on the mounted disk (via `DATA_DIR`), so records persist across deploys.

Each record looks like:

```json
{
  "id": "pay_1713618024321",
  "createdAt": "2026-04-20T14:20:24.321Z",
  "completedAt": "2026-04-20T14:21:02.104Z",
  "stripeSessionId": "cs_test_...",
  "status": "paid",
  "product": "camp",
  "parentName": "Jamie Example",
  "childName": "Alex Example",
  "childAge": "10",
  "childGrade": "5th",
  "email": "jamie@example.com",
  "phone": "555-123-4567",
  "amountCents": 135000,
  "currency": "usd",
  "weeks": [
    { "id": "w1", "label": "Week 1", "dates": "July 6–11, 2026" },
    { "id": "w2", "label": "Week 2", "dates": "July 13–18, 2026" },
    { "id": "w3", "label": "Week 3", "dates": "July 20–25, 2026" }
  ]
}
```

Code Lab records look similar but carry `"plan": "monthly" | "annual"` instead of `weeks`.

## Verification Checklist

Before going live, verify:

- [ ] `npm install` succeeds locally (pulls Stripe SDK).
- [ ] `node server.js` boots without throwing — the module loads even without env vars (lazy Stripe init).
- [ ] Visit `/#summer-register` — banner/countdown/week grid render.
- [ ] Visit `/codelab#membership` — toggle switches price between $14.99 and $99.99.
- [ ] With `STRIPE_SECRET_KEY` set, clicking **Register & Pay** redirects to Stripe Checkout.
- [ ] Run Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhook`) and complete a test payment with `4242 4242 4242 4242`.
- [ ] Browser lands on `/confirmation.html?session_id=…` with order summary visible.
- [ ] `/payments-admin` (Basic Auth) shows the new row.
- [ ] `curl -u admin:pass /api/payments/export?format=csv` downloads a CSV.
- [ ] If Resend is configured: the test email arrives.
- [ ] If Google Sheets is configured: a new row appears in the sheet.

See `PAYMENTS.md` for the full setup walk-through.
