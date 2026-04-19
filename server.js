const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const codeLabApp = require('./code-lab/server');
const app = express();
const PORT = process.env.PORT || 3000;
const sendCodeLabLanding = (res) => res.sendFile(path.join(__dirname, 'code-lab', 'code-lab.html'));
const sendCodeLabApp = (res) => res.sendFile(path.join(__dirname, 'code-lab', 'index.html'));
const summerInquiryFile = path.join(__dirname, 'code-lab', 'data', 'summer-inquiries.json');
const summerInquiryDir = path.dirname(summerInquiryFile);
const summerAdminUser = process.env.SUMMER_LEADS_ADMIN_USER || 'admin';
const summerAdminPassword = process.env.SUMMER_LEADS_ADMIN_PASSWORD || 'change-me';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Canonical marketing and main routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
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

function toCsvValue(value) {
	const normalized = value == null ? '' : String(value);
	return `"${normalized.replace(/"/g, '""')}"`;
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

app.post('/api/summer-inquiry', async (req, res) => {
	const {
		parentName = '',
		email = '',
		phone = '',
		childAge = '',
		programInterest = '',
		preferredWeek = '',
		notes = ''
	} = req.body || {};

	if (!parentName.trim() || !email.trim() || !phone.trim() || !childAge.trim() || !programInterest.trim() || !preferredWeek.trim()) {
		return res.status(400).json({ success: false, message: 'Missing required fields' });
	}

	const inquiryRecord = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		submittedAt: new Date().toISOString(),
		parentName: parentName.trim(),
		email: email.trim(),
		phone: phone.trim(),
		childAge: childAge.trim(),
		programInterest: programInterest.trim(),
		preferredWeek: preferredWeek.trim(),
		notes: typeof notes === 'string' ? notes.trim() : ''
	};

	try {
		await fs.mkdir(summerInquiryDir, { recursive: true });
		const existing = await readSummerInquiries();
		existing.push(inquiryRecord);
		await fs.writeFile(summerInquiryFile, JSON.stringify(existing, null, 2));
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

		const headers = ['id', 'submittedAt', 'parentName', 'email', 'phone', 'childAge', 'programInterest', 'preferredWeek', 'notes'];
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

// Static files for existing pages and assets
app.use(express.static(path.join(__dirname), { index: false }));

app.listen(PORT, () => console.log(`AI Future Platform running at http://localhost:${PORT}`));
