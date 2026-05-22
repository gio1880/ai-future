const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const codeLabApp = require('./code-lab/server');
const payments = require('./payments');
const app = express();
const PORT = process.env.PORT || 3000;
const metaPixelId = process.env.META_PIXEL_ID || '4538248653113103';
const metaGraphApiVersion = process.env.META_GRAPH_API_VERSION || 'v25.0';
const sendCodeLabLanding = (res) => res.sendFile(path.join(__dirname, 'code-lab', 'code-lab.html'));
const sendCodeLabApp = (res) => res.sendFile(path.join(__dirname, 'code-lab', 'index.html'));
const sendSummerCampAdsLanding = (res) => res.sendFile(path.join(__dirname, 'summer-camp-ads.html'));
const summerInquiryFile = path.join(__dirname, 'code-lab', 'data', 'summer-inquiries.json');
const summerInquiryDir = path.dirname(summerInquiryFile);
const summerAdminUser = process.env.SUMMER_LEADS_ADMIN_USER || 'admin';
const summerAdminPassword = process.env.SUMMER_LEADS_ADMIN_PASSWORD || 'change-me';
const platformDataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const parentInquiryFile = path.join(platformDataDir, 'parent-inquiries.json');
const parentInquiryDir = path.dirname(parentInquiryFile);
const parentAdminUser = process.env.PARENT_LEADS_ADMIN_USER || 'admin';
const parentAdminPassword = process.env.PARENT_LEADS_ADMIN_PASSWORD || 'change-me';

// Payments routes MUST mount before global express.json() — the Stripe webhook
// endpoint needs the raw request body to verify the signature.
payments.mount(app, express);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Canonical marketing and main routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get(['/summer-camp-ads', '/summer-camp-ads/'], (req, res) => sendSummerCampAdsLanding(res));
app.get(['/summer-camp', '/summer-camp/'], (req, res) => res.redirect(302, '/contact?program=Summer%20Camp'));
app.get(['/contact', '/contact/'], (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/robotics-lab', (req, res) => res.sendFile(path.join(__dirname, 'robotics lab', 'robotics-lab.html')));
app.get(['/codelab', '/codelab/'], (req, res) => sendCodeLabLanding(res));
app.get('/codelab/app', (req, res) => sendCodeLabApp(res));

// Legacy compatibility redirects
app.get('/code-lab', (req, res) => res.redirect(301, '/codelab'));
app.get('/code-lab/', (req, res) => res.redirect(301, '/codelab'));
app.get('/code-lab.html', (req, res) => res.redirect(301, '/codelab'));
app.get('/code-lab/dashboard', (req, res) => res.redirect(301, '/codelab/dashboard'));
app.get('/code-lab/dashboard.html', (req, res) => res.redirect(301, '/codelab/dashboard'));
app.get('/code-lab/login', (req, res) => res.redirect(301, '/codelab/login'));
app.get('/code-lab/signup', (req, res) => res.redirect(301, '/codelab/signup'));
app.get('/code-lab/admin', (req, res) => res.redirect(301, '/codelab/admin'));
app.get('/code-lab/dev', (req, res) => res.redirect(301, '/dev'));
app.get('/code-lab/dev/*', (req, res) => res.redirect(301, `/dev/${req.params[0]}`));
app.get('/admin', (req, res, next) => codeLabApp(req, res, next));
app.get('/admin/', (req, res, next) => codeLabApp(req, res, next));
app.get('/code-lab/lesson/:slug', (req, res) => res.redirect(301, `/codelab/lesson/${encodeURIComponent(req.params.slug)}`));
app.get('/code-lab/lesson/:slug.html', (req, res) => res.redirect(301, `/codelab/lesson/${encodeURIComponent(req.params.slug)}`));

// Local Code Lab app routes (no external proxy)
app.get('/codelab/login', (req, res) => res.redirect(302, '/codelab/app'));
app.get('/codelab/signup', (req, res) => res.redirect(302, '/codelab/app'));
app.get('/codelab/dashboard', (req, res) => res.redirect(302, '/codelab/app#page-home'));
app.get('/codelab/lesson/:slug', (req, res) => res.redirect(302, '/codelab/app'));
app.get('/codelab/admin', (req, res) => res.redirect(302, '/admin'));
app.get('/codelab/dev', (req, res) => res.redirect(302, '/dev'));
app.get('/codelab/dev/*', (req, res) => res.redirect(302, `/dev/${req.params[0]}`));

async function readSummerInquiries() {
	try {
		const raw = await fs.readFile(summerInquiryFile, 'utf8');
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch (readErr) {
		if (readErr.code === 'ENOENT') {
			return [];
		}
		throw readErr;
	}
}

async function readParentInquiries() {
	try {
		const raw = await fs.readFile(parentInquiryFile, 'utf8');
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch (readErr) {
		if (readErr.code === 'ENOENT') {
			return [];
		}
		throw readErr;
	}
}

function toCsvValue(value) {
	const normalized = value == null ? '' : String(value);
	return `"${normalized.replace(/"/g, '""')}"`;
}

function sha256(value) {
	return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeEmailForMeta(email) {
	return email.trim().toLowerCase();
}

function normalizePhoneForMeta(phone) {
	return phone.replace(/[^\d]/g, '');
}

function getClientIp(req) {
	const forwardedFor = req.headers['x-forwarded-for'];
	if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
		return forwardedFor.split(',')[0].trim();
	}
	return req.socket?.remoteAddress || '';
}

function cleanMetaString(value, maxLength = 500) {
	if (typeof value !== 'string') return '';
	return value.trim().slice(0, maxLength);
}

async function sendMetaLeadEvent(req, inquiryRecord, meta = {}) {
	const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
	if (!accessToken || accessToken === 'replace_with_meta_token') return;

	const userData = {};
	const emailForHash = normalizeEmailForMeta(inquiryRecord.email || '');
	const phoneForHash = normalizePhoneForMeta(inquiryRecord.phone || '');
	const fbp = cleanMetaString(meta.fbp, 200);
	const fbc = cleanMetaString(meta.fbc, 200);
	const clientIp = getClientIp(req);
	const userAgent = cleanMetaString(req.get('user-agent') || '', 500);

	if (emailForHash) userData.em = [sha256(emailForHash)];
	if (phoneForHash) userData.ph = [sha256(phoneForHash)];
	if (fbp) userData.fbp = fbp;
	if (fbc) userData.fbc = fbc;
	if (clientIp) userData.client_ip_address = clientIp;
	if (userAgent) userData.client_user_agent = userAgent;

	const eventSourceUrl = cleanMetaString(meta.eventSourceUrl, 1000) || `${req.protocol}://${req.get('host')}/summer-camp-ads`;
	const payload = {
		data: [{
			event_name: 'Lead',
			event_time: Math.floor(Date.now() / 1000),
			event_id: cleanMetaString(meta.eventId, 200) || inquiryRecord.id,
			action_source: 'website',
			event_source_url: eventSourceUrl,
			user_data: userData,
			custom_data: {
				content_name: 'AI Future Summer Camp',
				content_category: 'summer_camp',
				status: 'lead'
			}
		}]
	};

	const testEventCode = cleanMetaString(process.env.META_TEST_EVENT_CODE, 200);
	if (testEventCode && testEventCode !== 'replace_only_during_meta_testing') {
		payload.test_event_code = testEventCode;
	}

	try {
		const url = `https://graph.facebook.com/${metaGraphApiVersion}/${encodeURIComponent(metaPixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			console.warn('[meta-capi] Lead event rejected', response.status);
		}
	} catch (err) {
		console.warn('[meta-capi] Lead event failed', err.message);
	}
}

function getBasicAuthCredentials(req) {
	const authHeader = req.headers.authorization || '';
	if (!authHeader.startsWith('Basic ')) {
		return null;
	}

	try {
		const encoded = authHeader.slice(6);
		const decoded = Buffer.from(encoded, 'base64').toString('utf8');
		const separatorIndex = decoded.indexOf(':');
		if (separatorIndex === -1) {
			return null;
		}

		return {
			username: decoded.slice(0, separatorIndex),
			password: decoded.slice(separatorIndex + 1)
		};
	} catch (err) {
		return null;
	}
}

function requireSummerAdmin(req, res, next) {
	const headerPassword = typeof req.headers['x-admin-password'] === 'string' ? req.headers['x-admin-password'] : '';
	if (headerPassword && headerPassword === summerAdminPassword) {
		return next();
	}

	const credentials = getBasicAuthCredentials(req);
	const isAuthorized = credentials && credentials.username === summerAdminUser && credentials.password === summerAdminPassword;
	if (isAuthorized) {
		return next();
	}

	res.set('WWW-Authenticate', 'Basic realm="AI Future Summer Leads"');
	return res.status(401).send('Authentication required');
}

function requireParentAdmin(req, res, next) {
	const headerPassword = typeof req.headers['x-admin-password'] === 'string' ? req.headers['x-admin-password'] : '';
	if (headerPassword && headerPassword === parentAdminPassword) {
		return next();
	}

	const credentials = getBasicAuthCredentials(req);
	const isAuthorized = credentials && credentials.username === parentAdminUser && credentials.password === parentAdminPassword;
	if (isAuthorized) {
		return next();
	}

	res.set('WWW-Authenticate', 'Basic realm="AI Future Parent Leads"');
	return res.status(401).send('Authentication required');
}

app.post('/api/parent-inquiry', async (req, res) => {
	const {
		parentName = '',
		studentName = '',
		childName = '',
		childAge = '',
		email = '',
		phone = '',
		programInterest = '',
		preferredContact = '',
		message = '',
		sourcePage = ''
	} = req.body || {};

	const normalizedStudentName = studentName.trim() || childName.trim();

	if (!parentName.trim() || !email.trim() || !phone.trim() || !programInterest.trim()) {
		return res.status(400).json({ success: false, message: 'Please complete parent name, email, phone, and program interest.' });
	}

	const inquiryRecord = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		submittedAt: new Date().toISOString(),
		parentName: parentName.trim(),
		studentName: normalizedStudentName,
		childAge: childAge.trim(),
		email: email.trim(),
		phone: phone.trim(),
		programInterest: programInterest.trim(),
		preferredContact: preferredContact.trim(),
		message: typeof message === 'string' ? message.trim() : '',
		sourcePage: typeof sourcePage === 'string' ? sourcePage.trim() : ''
	};

	try {
		await fs.mkdir(parentInquiryDir, { recursive: true });
		const existing = await readParentInquiries();
		existing.push(inquiryRecord);
		await fs.writeFile(parentInquiryFile, JSON.stringify(existing, null, 2));
		return res.status(201).json({ success: true, message: 'Inquiry received' });
	} catch (err) {
		console.error('Parent inquiry save error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving inquiry' });
	}
});

app.get('/parent-leads-admin', requireParentAdmin, (req, res) => {
	res.sendFile(path.join(__dirname, 'parent-leads-admin.html'));
});

app.get('/api/parent-inquiry/list', requireParentAdmin, async (req, res) => {
	try {
		const inquiries = await readParentInquiries();
		return res.json({ success: true, count: inquiries.length, data: inquiries });
	} catch (err) {
		console.error('Parent inquiry list error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading inquiries' });
	}
});

app.get('/api/parent-inquiry/export', requireParentAdmin, async (req, res) => {
	const format = (req.query.format || 'csv').toString().toLowerCase();

	try {
		const inquiries = await readParentInquiries();

		if (format === 'json') {
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			res.setHeader('Content-Disposition', 'attachment; filename="parent-inquiries.json"');
			return res.status(200).send(JSON.stringify(inquiries, null, 2));
		}

		const headers = ['id', 'submittedAt', 'parentName', 'studentName', 'childAge', 'email', 'phone', 'programInterest', 'preferredContact', 'message', 'sourcePage'];
		const rows = inquiries.map((record) => headers.map((key) => toCsvValue(record[key] ?? '')).join(','));
		const csvContent = [headers.join(','), ...rows].join('\n');

		res.setHeader('Content-Type', 'text/csv; charset=utf-8');
		res.setHeader('Content-Disposition', 'attachment; filename="parent-inquiries.csv"');
		return res.status(200).send(csvContent);
	} catch (err) {
		console.error('Parent inquiry export error:', err);
		return res.status(500).json({ success: false, message: 'Server error exporting inquiries' });
	}
});

app.post('/api/summer-inquiry', async (req, res) => {
	const {
		parentName = '',
		childName = '',
		childGrade = '',
		email = '',
		phone = '',
		childAge = '',
		programInterest = '',
		preferredWeek = '',
		promoCode = '',
		freeTrialInterest = '',
		notes = '',
		metaEventId = '',
		metaFbp = '',
		metaFbc = '',
		metaEventSourceUrl = ''
	} = req.body || {};

	const normalizedChildGrade = childGrade.trim() || childAge.trim();
	const normalizedProgramInterest = programInterest.trim() || preferredWeek.trim();
	const normalizedEmail = email.trim();
	const normalizedPhone = phone.trim();
	const hasContactMethod = Boolean(normalizedEmail || normalizedPhone);

	if (!parentName.trim() || !hasContactMethod) {
		return res.status(400).json({ success: false, message: 'Missing required fields' });
	}

	const inquiryRecord = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		submittedAt: new Date().toISOString(),
		parentName: parentName.trim(),
		childName: childName.trim(),
		childGrade: normalizedChildGrade,
		email: normalizedEmail,
		phone: normalizedPhone,
		childAge: normalizedChildGrade,
		programInterest: normalizedProgramInterest,
		preferredWeek: preferredWeek.trim(),
		promoCode: promoCode.trim(),
		freeTrialInterest: freeTrialInterest.trim(),
		notes: typeof notes === 'string' ? notes.trim() : ''
	};

	try {
		await fs.mkdir(summerInquiryDir, { recursive: true });
		const existing = await readSummerInquiries();
		existing.push(inquiryRecord);
		await fs.writeFile(summerInquiryFile, JSON.stringify(existing, null, 2));
		void sendMetaLeadEvent(req, inquiryRecord, {
			eventId: metaEventId,
			fbp: metaFbp,
			fbc: metaFbc,
			eventSourceUrl: metaEventSourceUrl
		});
		return res.status(201).json({ success: true, message: 'Inquiry received' });
	} catch (err) {
		console.error('Summer inquiry save error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving inquiry' });
	}
});

app.get('/summer-leads-admin', requireSummerAdmin, (req, res) => {
	res.sendFile(path.join(__dirname, 'summer-leads-admin.html'));
});

app.get('/api/summer-inquiry/list', requireSummerAdmin, async (req, res) => {
	try {
		const inquiries = await readSummerInquiries();
		return res.json({ success: true, count: inquiries.length, data: inquiries });
	} catch (err) {
		console.error('Summer inquiry list error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading inquiries' });
	}
});

app.get('/api/summer-inquiry/export', requireSummerAdmin, async (req, res) => {
	const format = (req.query.format || 'csv').toString().toLowerCase();

	try {
		const inquiries = await readSummerInquiries();

		if (format === 'json') {
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			res.setHeader('Content-Disposition', 'attachment; filename="summer-inquiries.json"');
			return res.status(200).send(JSON.stringify(inquiries, null, 2));
		}

		const headers = ['id', 'submittedAt', 'parentName', 'childName', 'childGrade', 'email', 'phone', 'childAge', 'programInterest', 'preferredWeek', 'promoCode', 'freeTrialInterest', 'notes'];
		const rows = inquiries.map((record) => headers.map((key) => toCsvValue(record[key] ?? '')).join(','));
		const csvContent = [headers.join(','), ...rows].join('\n');

		res.setHeader('Content-Type', 'text/csv; charset=utf-8');
		res.setHeader('Content-Disposition', 'attachment; filename="summer-inquiries.csv"');
		return res.status(200).send(csvContent);
	} catch (err) {
		console.error('Summer inquiry export error:', err);
		return res.status(500).json({ success: false, message: 'Server error exporting inquiries' });
	}
});

app.get('/dev', (req, res, next) => {
	req.url = '/dev';
	codeLabApp(req, res, next);
});
app.get('/dev/*', (req, res, next) => {
	req.url = `/dev/${req.params[0]}`;
	codeLabApp(req, res, next);
});
app.use('/codelab/api', (req, res, next) => {
	req.url = `/api${req.url}`;
	codeLabApp(req, res, next);
});
app.use('/api', (req, res, next) => {
	req.url = `/api${req.url}`;
	codeLabApp(req, res, next);
});
app.use('/fll-assets', (req, res, next) => {
	req.url = `/fll-assets${req.url}`;
	codeLabApp(req, res, next);
});

// Static files for existing pages and assets. Media gets a longer browser cache
// because the landing pages reuse the same photo/video assets across sessions.
app.use(express.static(path.join(__dirname), {
	index: false,
	etag: true,
	lastModified: true,
	setHeaders(res, filePath) {
		if (/\.(?:avif|webp|png|jpe?g|gif|svg|mp4|webm|woff2?)$/i.test(filePath)) {
			res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
		}
	}
}));

app.listen(PORT, () => console.log(`AI Future Platform running at http://localhost:${PORT}`));
