/**
 * AI Future — Payments module
 * -----------------------------------------------------------------------------
 * Handles Stripe Checkout for:
 *   - Summer Camp weekly registration (one-time payment, N weeks selected)
 *   - Code Lab Membership (monthly or annual recurring subscription)
 *
 * Mounts on the existing Express server (see server.js) — not a Netlify / Vercel
 * function, because this site is deployed to Render as a Node/Express app.
 *
 * Exposes:
 *   POST /api/create-checkout   — start a Stripe Checkout Session
 *   POST /api/webhook           — Stripe webhook listener (raw body required)
 *   GET  /api/payments/list     — admin list of registrations (basic auth)
 *   GET  /api/payments/export   — CSV export of registrations
 *
 * On checkout.session.completed:
 *   - Appends the record to code-lab/data/payments.json
 *   - Emails the parent via Resend (if RESEND_API_KEY set)
 *   - Appends a row to Google Sheets (if GOOGLE_SHEETS_ID + service account set)
 *
 * Env vars (see .env.example):
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   STRIPE_CODELAB_MONTHLY_PRICE_ID
 *   STRIPE_CODELAB_ANNUAL_PRICE_ID
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL           (default: "AI Future <no-reply@aifuture.com>")
 *   GOOGLE_SHEETS_ID
 *   GOOGLE_SERVICE_ACCOUNT_JSON (stringified JSON service-account credentials)
 *   PAYMENTS_ADMIN_USER         (default: "admin")
 *   PAYMENTS_ADMIN_PASSWORD     (default: "change-me")
 *   SITE_BASE_URL               (default: request host; used for success/cancel URLs)
 * -----------------------------------------------------------------------------
 */

const path = require('path');
const fs = require('fs/promises');
const fssync = require('fs');

const PAYMENTS_FILE = path.join(__dirname, 'code-lab', 'data', 'payments.json');
const PAYMENTS_DIR = path.dirname(PAYMENTS_FILE);

const ADMIN_USER = process.env.PAYMENTS_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.PAYMENTS_ADMIN_PASSWORD || 'change-me';

// ─── Pricing config (kept server-side so clients can't tamper) ───────────────
const PRICING = {
  camp: {
    earlyBird: 500_00,          // cents — valid until EARLY_BIRD_DEADLINE
    regular: 550_00,
    earlyBirdDeadlineISO: '2026-06-15T23:59:59-04:00',  // America/New_York
    currency: 'usd',
    weeks: [
      { id: 'w1', label: 'Week 1', dates: 'July 6–11, 2026' },
      { id: 'w2', label: 'Week 2', dates: 'July 13–18, 2026' },
      { id: 'w3', label: 'Week 3', dates: 'July 20–25, 2026' },
      { id: 'w4', label: 'Week 4', dates: 'July 27 – Aug 1, 2026' },
      { id: 'w5', label: 'Week 5', dates: 'Aug 3–8, 2026' },
      { id: 'w6', label: 'Week 6', dates: 'Aug 10–15, 2026' },
      { id: 'w7', label: 'Week 7', dates: 'Aug 17–22, 2026' },
      { id: 'w8', label: 'Week 8', dates: 'Aug 24–29, 2026' },
      { id: 'w9', label: 'Week 9', dates: 'Aug 31 – Sep 5, 2026' },
    ],
  },
  codelab: {
    monthly: {
      amount: 14_99,
      currency: 'usd',
      interval: 'month',
      productName: 'AI Future Code Lab — Monthly',
      envPriceId: 'STRIPE_CODELAB_MONTHLY_PRICE_ID',
    },
    annual: {
      amount: 99_99,
      currency: 'usd',
      interval: 'year',
      productName: 'AI Future Code Lab — Annual (Save 44%)',
      envPriceId: 'STRIPE_CODELAB_ANNUAL_PRICE_ID',
    },
  },
};

function isEarlyBird(now) {
  const deadline = new Date(PRICING.camp.earlyBirdDeadlineISO).getTime();
  return (now || Date.now()) < deadline;
}

// Expose pricing to the front-end (cents) so the calendar stays authoritative
function publicPricing() {
  return {
    camp: {
      earlyBird: PRICING.camp.earlyBird,
      regular: PRICING.camp.regular,
      earlyBirdDeadlineISO: PRICING.camp.earlyBirdDeadlineISO,
      currency: PRICING.camp.currency,
      weeks: PRICING.camp.weeks,
      currentWeekPrice: isEarlyBird() ? PRICING.camp.earlyBird : PRICING.camp.regular,
      pricingTier: isEarlyBird() ? 'early-bird' : 'regular',
    },
    codelab: {
      monthly: { amount: PRICING.codelab.monthly.amount, currency: PRICING.codelab.monthly.currency },
      annual: { amount: PRICING.codelab.annual.amount, currency: PRICING.codelab.annual.currency },
    },
  };
}

// ─── Tiny helpers ────────────────────────────────────────────────────────────
function sanitizeString(v, max = 200) {
  if (v == null) return '';
  return String(v).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function sanitizeEmail(v) {
  const s = sanitizeString(v, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}

function basicAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx !== -1) {
        const user = decoded.slice(0, idx);
        const pass = decoded.slice(idx + 1);
        if (user === ADMIN_USER && pass === ADMIN_PASSWORD) return next();
      }
    } catch (_) {}
  }
  res.set('WWW-Authenticate', 'Basic realm="AI Future Payments"');
  return res.status(401).send('Authentication required');
}

async function ensurePaymentsFile() {
  await fs.mkdir(PAYMENTS_DIR, { recursive: true });
  try {
    await fs.access(PAYMENTS_FILE);
  } catch (_) {
    await fs.writeFile(PAYMENTS_FILE, '[]');
  }
}

async function readPayments() {
  await ensurePaymentsFile();
  try {
    const raw = await fs.readFile(PAYMENTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Payments read error:', e.message);
    return [];
  }
}

async function appendPayment(record) {
  const list = await readPayments();
  list.push(record);
  await fs.writeFile(PAYMENTS_FILE, JSON.stringify(list, null, 2));
}

function toCsvValue(v) {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

// ─── Stripe ──────────────────────────────────────────────────────────────────
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    // eslint-disable-next-line global-require
    const Stripe = require('stripe');
    _stripe = Stripe(key);
    return _stripe;
  } catch (e) {
    console.error('Stripe SDK not installed. Run: npm install stripe');
    return null;
  }
}

function siteBaseUrl(req) {
  if (process.env.SITE_BASE_URL) return process.env.SITE_BASE_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// ─── Resend email ────────────────────────────────────────────────────────────
async function sendConfirmationEmail({ toEmail, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[payments] RESEND_API_KEY not set — skipping email send');
    return { skipped: true };
  }
  const from = process.env.RESEND_FROM_EMAIL || 'AI Future <no-reply@aifuture.com>';
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [toEmail], subject, html }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[payments] Resend error', resp.status, errText.slice(0, 400));
      return { ok: false, error: resp.status };
    }
    const data = await resp.json().catch(() => ({}));
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[payments] Resend throw', err);
    return { ok: false, error: err.message };
  }
}

function summerConfirmationHTML(record) {
  const weekList = (record.weeks || [])
    .map(w => `<li style="margin:0.2rem 0">${w.label} — ${w.dates}</li>`)
    .join('');
  return `
  <div style="font-family:Inter,Segoe UI,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1A2335;">
    <div style="background:#FECE00;padding:1.25rem 1.5rem;border-radius:14px 14px 0 0;text-align:center;">
      <div style="font-weight:900;letter-spacing:.02em;color:#001B3F;font-size:1.25rem;">AI FUTURE</div>
      <div style="color:#001B3F;font-size:.85rem;opacity:.8;">Summer Camp 2026 — Enrollment Confirmed</div>
    </div>
    <div style="background:#fff;padding:1.75rem 1.5rem;border:1px solid #E2E8F0;border-top:0;border-radius:0 0 14px 14px;">
      <h2 style="color:#001B3F;font-size:1.25rem;margin:0 0 1rem;">Thank you, ${record.parentName || 'Parent'}! ☀</h2>
      <p style="margin:0 0 1rem;line-height:1.65;color:#2E3440;">
        Your summer camp enrollment for <strong>${record.childName || 'your child'}</strong> is confirmed.
        We're excited to have them at AI Future this summer!
      </p>
      <div style="background:#FFF8E1;border:1px solid rgba(254,206,0,.4);border-radius:12px;padding:1rem 1.25rem;margin:1.25rem 0;">
        <div style="font-weight:700;color:#001B3F;margin-bottom:.4rem;">Weeks Enrolled (${(record.weeks || []).length})</div>
        <ul style="margin:0;padding-left:1.1rem;color:#2E3440;font-size:.92rem;">${weekList}</ul>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:.92rem;">
        <tr><td style="padding:.3rem 0;color:#64748B;">Total Paid</td><td style="padding:.3rem 0;text-align:right;font-weight:700;color:#001B3F;">$${((record.amountPaid || 0) / 100).toFixed(2)}</td></tr>
        <tr><td style="padding:.3rem 0;color:#64748B;">Child Age/Grade</td><td style="padding:.3rem 0;text-align:right;color:#1A2335;">${record.childGrade || ''}</td></tr>
        <tr><td style="padding:.3rem 0;color:#64748B;">Contact Phone</td><td style="padding:.3rem 0;text-align:right;color:#1A2335;">${record.phone || ''}</td></tr>
      </table>
      <p style="margin:1.5rem 0 0;font-size:.88rem;color:#64748B;line-height:1.6;">
        We'll follow up with your child's first-day checklist and location details a week before camp starts.
        Questions? Reply to this email or reach us at <a href="mailto:info@aifuture.com" style="color:#2563FF;">info@aifuture.com</a>.
      </p>
      <div style="margin-top:1.5rem;text-align:center;">
        <a href="https://aifuture.com" style="display:inline-block;padding:.7rem 1.5rem;background:#073E77;color:#fff;border-radius:9999px;text-decoration:none;font-weight:600;font-size:.9rem;">Visit AI Future</a>
      </div>
    </div>
  </div>`;
}

function codelabConfirmationHTML(record) {
  const planLabel = record.plan === 'annual'
    ? 'Annual ($99.99/year — Save 44%)'
    : 'Monthly ($14.99/month)';
  return `
  <div style="font-family:Inter,Segoe UI,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1A2335;">
    <div style="background:linear-gradient(135deg,#1e0a4e,#6D4AFF);padding:1.25rem 1.5rem;border-radius:14px 14px 0 0;text-align:center;">
      <div style="font-weight:900;letter-spacing:.02em;color:#fff;font-size:1.25rem;">AI FUTURE CODE LAB</div>
      <div style="color:rgba(255,255,255,.85);font-size:.85rem;">Membership Activated</div>
    </div>
    <div style="background:#fff;padding:1.75rem 1.5rem;border:1px solid #E2E8F0;border-top:0;border-radius:0 0 14px 14px;">
      <h2 style="color:#001B3F;font-size:1.25rem;margin:0 0 1rem;">Welcome, ${record.parentName || 'Parent'}! 🎉</h2>
      <p style="margin:0 0 1rem;line-height:1.65;color:#2E3440;">
        <strong>${record.childName || 'Your child'}</strong>'s Code Lab membership is active.
        They now have unlimited access to interactive Python lessons, projects, and the AI Tutor.
      </p>
      <div style="background:rgba(109,74,255,.08);border:1px solid rgba(109,74,255,.25);border-radius:12px;padding:1rem 1.25rem;margin:1.25rem 0;">
        <div style="color:#64748B;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;">Plan</div>
        <div style="font-weight:700;color:#001B3F;margin-top:.2rem;">${planLabel}</div>
      </div>
      <div style="margin:1.25rem 0;text-align:center;">
        <a href="https://aifuture.com/codelab/app" style="display:inline-block;padding:.8rem 1.75rem;background:#FECE00;color:#001B3F;border-radius:9999px;text-decoration:none;font-weight:700;">Open Code Lab →</a>
      </div>
      <p style="margin:1.5rem 0 0;font-size:.88rem;color:#64748B;line-height:1.6;">
        Your teacher will create the student account and send login details within one business day.
        Manage your subscription anytime via the Stripe billing portal link in your receipt.
      </p>
    </div>
  </div>`;
}

// ─── Google Sheets append ────────────────────────────────────────────────────
async function getGoogleAccessToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    console.error('[payments] GOOGLE_SERVICE_ACCOUNT_JSON parse error', e.message);
    return null;
  }
  if (!creds.client_email || !creds.private_key) return null;

  // eslint-disable-next-line global-require
  const crypto = require('crypto');
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claim)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const sig = signer.sign(creds.private_key).toString('base64url');
  const assertion = `${unsigned}.${sig}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!resp.ok) {
    console.error('[payments] Google token error', resp.status, await resp.text().catch(() => ''));
    return null;
  }
  const data = await resp.json();
  return data.access_token;
}

async function appendToSheet(record) {
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheetId) {
    console.log('[payments] GOOGLE_SHEETS_ID not set — skipping Sheets append');
    return { skipped: true };
  }
  const token = await getGoogleAccessToken();
  if (!token) return { skipped: true, reason: 'no-token' };

  const row = [
    record.timestamp,
    record.parentName,
    record.childName,
    record.childGrade,
    record.email,
    record.phone || '',
    record.productType,                            // "camp" | "codelab"
    ((record.amountPaid || 0) / 100).toFixed(2),
    record.productType === 'camp'
      ? (record.weeks || []).map(w => w.label).join(' | ')
      : '',
    record.productType === 'codelab' ? (record.plan || '') : '',
    record.stripeSessionId || '',
  ];

  const range = encodeURIComponent('Registrations!A:K');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ values: [row] }),
  });
  if (!resp.ok) {
    console.error('[payments] Sheets append error', resp.status, await resp.text().catch(() => ''));
    return { ok: false };
  }
  return { ok: true };
}

// ─── Route handlers ──────────────────────────────────────────────────────────
async function handleCreateCheckout(req, res) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({
        success: false,
        error: 'Payments are not configured yet. Please contact the admin.',
      });
    }

    const b = req.body || {};
    const productType = sanitizeString(b.productType || b.product, 20);
    const parentName = sanitizeString(b.parentName, 120);
    const childName = sanitizeString(b.childName, 120);
    const childGrade = sanitizeString(b.childGrade, 40);
    const email = sanitizeEmail(b.email);
    const phone = sanitizeString(b.phone, 40);

    if (!parentName || !childName || !childGrade || !email) {
      return res.status(400).json({ success: false, error: 'Please fill out all required fields.' });
    }

    const base = siteBaseUrl(req);
    const successUrl = `${base}/confirmation.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${base}/?checkout=cancelled#summer-register`;

    if (productType === 'camp') {
      if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required for camp.' });
      const requestedIds = Array.isArray(b.weeks) ? b.weeks : [];
      const selected = PRICING.camp.weeks.filter(w => requestedIds.includes(w.id));
      if (selected.length === 0) {
        return res.status(400).json({ success: false, error: 'Please select at least one week.' });
      }
      const unitPrice = isEarlyBird() ? PRICING.camp.earlyBird : PRICING.camp.regular;
      const tier = isEarlyBird() ? 'early-bird' : 'regular';

      const line_items = selected.map(w => ({
        price_data: {
          currency: PRICING.camp.currency,
          unit_amount: unitPrice,
          product_data: {
            name: `Summer Camp ${w.label}`,
            description: w.dates,
          },
        },
        quantity: 1,
      }));

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items,
        customer_email: email,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          productType: 'camp',
          parentName, childName, childGrade, email, phone,
          weeks: JSON.stringify(selected.map(w => ({ id: w.id, label: w.label, dates: w.dates }))),
          pricingTier: tier,
          unitPrice: String(unitPrice),
        },
      });
      return res.json({ success: true, url: session.url, id: session.id });
    }

    if (productType === 'codelab') {
      const plan = sanitizeString(b.plan, 10); // "monthly" | "annual"
      const planCfg = plan === 'annual' ? PRICING.codelab.annual : PRICING.codelab.monthly;
      const priceId = process.env[planCfg.envPriceId];

      let line_items;
      let mode = 'subscription';
      if (priceId) {
        line_items = [{ price: priceId, quantity: 1 }];
      } else {
        // Fall back to inline price_data if a Stripe Price ID hasn't been created yet.
        // This works for one-time captures; for true recurring billing prefer a
        // pre-created recurring Price ID (Dashboard → Products → Add product).
        mode = 'payment';
        line_items = [{
          price_data: {
            currency: planCfg.currency,
            unit_amount: planCfg.amount,
            product_data: { name: planCfg.productName },
          },
          quantity: 1,
        }];
      }

      const session = await stripe.checkout.sessions.create({
        mode,
        payment_method_types: ['card'],
        line_items,
        customer_email: email,
        success_url: successUrl,
        cancel_url: `${base}/codelab?checkout=cancelled#codelab-membership`,
        metadata: {
          productType: 'codelab',
          parentName, childName, childGrade, email,
          plan: plan === 'annual' ? 'annual' : 'monthly',
        },
      });
      return res.json({ success: true, url: session.url, id: session.id });
    }

    return res.status(400).json({ success: false, error: 'Unknown productType.' });
  } catch (err) {
    console.error('[payments] create-checkout error:', err);
    return res.status(500).json({ success: false, error: 'Could not start checkout.' });
  }
}

async function handleWebhook(req, res) {
  const stripe = getStripe();
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !signingSecret) {
    console.warn('[payments] Webhook received but Stripe is not fully configured');
    return res.status(200).send('OK (not configured)');
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, signingSecret);
  } catch (err) {
    console.error('[payments] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};

    let weeks = [];
    if (meta.productType === 'camp' && meta.weeks) {
      try { weeks = JSON.parse(meta.weeks); } catch (_) { weeks = []; }
    }

    const record = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      productType: meta.productType || 'unknown',
      parentName: meta.parentName || '',
      childName: meta.childName || '',
      childGrade: meta.childGrade || '',
      email: meta.email || session.customer_email || '',
      phone: meta.phone || '',
      amountPaid: session.amount_total || 0,
      currency: session.currency || 'usd',
      plan: meta.plan || null,
      weeks,
      pricingTier: meta.pricingTier || null,
      stripeSessionId: session.id,
      stripeCustomerId: session.customer || null,
      stripePaymentStatus: session.payment_status || null,
    };

    try { await appendPayment(record); } catch (e) { console.error('appendPayment failed', e); }

    // Email + Sheets run in parallel, best-effort — never fail the webhook
    const tasks = [];
    if (record.email) {
      const { subject, html } = meta.productType === 'codelab'
        ? { subject: 'Welcome to AI Future Code Lab!', html: codelabConfirmationHTML(record) }
        : { subject: 'AI Future Summer Camp — Enrollment Confirmed ☀', html: summerConfirmationHTML(record) };
      tasks.push(sendConfirmationEmail({ toEmail: record.email, subject, html }).catch(e => ({ error: e.message })));
    }
    tasks.push(appendToSheet(record).catch(e => ({ error: e.message })));
    await Promise.allSettled(tasks);
  }

  res.json({ received: true });
}

async function handleList(req, res) {
  try {
    const list = await readPayments();
    res.json({ success: true, count: list.length, data: list });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Could not read payments.' });
  }
}

async function handleExport(req, res) {
  try {
    const list = await readPayments();
    const headers = [
      'timestamp', 'productType', 'parentName', 'childName', 'childGrade', 'email', 'phone',
      'amountPaid_usd', 'plan', 'weeks', 'pricingTier', 'stripeSessionId', 'stripePaymentStatus',
    ];
    const rows = list.map(r => [
      r.timestamp,
      r.productType,
      r.parentName,
      r.childName,
      r.childGrade,
      r.email,
      r.phone,
      ((r.amountPaid || 0) / 100).toFixed(2),
      r.plan || '',
      (r.weeks || []).map(w => w.label).join(' | '),
      r.pricingTier || '',
      r.stripeSessionId || '',
      r.stripePaymentStatus || '',
    ].map(toCsvValue).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ai-future-payments.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ success: false, error: 'Could not export payments.' });
  }
}

async function handlePricing(req, res) {
  res.json({ success: true, ...publicPricing() });
}

async function handleSessionLookup(req, res) {
  try {
    const sessionId = sanitizeString(req.query.id, 200);
    if (!sessionId) return res.status(400).json({ success: false, error: 'Missing session id' });

    // First try local payments log (populated by the webhook)
    const list = await readPayments();
    const match = list.find(r => r.stripeSessionId === sessionId);
    if (match) {
      return res.json({
        success: true,
        from: 'local',
        productType: match.productType,
        parentName: match.parentName,
        childName: match.childName,
        email: match.email,
        amountPaid: match.amountPaid,
        plan: match.plan,
        weeks: match.weeks,
      });
    }

    // Fallback to Stripe (webhook may not have fired yet)
    const stripe = getStripe();
    if (!stripe) return res.json({ success: true, from: 'none', pending: true });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const meta = session.metadata || {};
    let weeks = [];
    try { if (meta.weeks) weeks = JSON.parse(meta.weeks); } catch (_) {}
    res.json({
      success: true,
      from: 'stripe',
      productType: meta.productType || 'unknown',
      parentName: meta.parentName || '',
      childName: meta.childName || '',
      email: meta.email || session.customer_email || '',
      amountPaid: session.amount_total || 0,
      plan: meta.plan || null,
      weeks,
      stripePaymentStatus: session.payment_status || null,
    });
  } catch (err) {
    console.error('[payments] session lookup error:', err.message);
    res.status(200).json({ success: true, pending: true });
  }
}

// ─── Mount ───────────────────────────────────────────────────────────────────
/**
 * Attach all payments routes to an existing Express app.
 * Call BEFORE `app.use(express.json())` so the webhook can read the raw body.
 */
function mount(app, express) {
  // Webhook MUST receive the raw body — mount it before express.json()
  app.post('/api/webhook', express.raw({ type: 'application/json' }), handleWebhook);

  // Everything else can use parsed JSON (assumes express.json is already installed on the app)
  app.post('/api/create-checkout', express.json(), handleCreateCheckout);
  app.get('/api/payments/pricing', handlePricing);
  app.get('/api/payments/session', handleSessionLookup);
  app.get('/api/payments/list', basicAuth, handleList);
  app.get('/api/payments/export', basicAuth, handleExport);
  app.get('/payments-admin', basicAuth, (req, res) =>
    res.sendFile(path.join(__dirname, 'payments-admin.html')));
}

module.exports = { mount, PRICING, publicPricing, readPayments };
