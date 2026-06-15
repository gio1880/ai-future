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
const platformDataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const summerInquiryFile = path.join(platformDataDir, 'summer-inquiries.json');
const summerInquiryDir = path.dirname(summerInquiryFile);
const activeVisitorWindowMs = 2 * 60 * 1000;
const summerAdminUser = process.env.SUMMER_LEADS_ADMIN_USER || 'admin';
const summerAdminPassword = process.env.SUMMER_LEADS_ADMIN_PASSWORD || 'change-me';
const summerTrafficFile = path.join(platformDataDir, 'summer-traffic.json');
const summerTrafficDir = path.dirname(summerTrafficFile);
const parentInquiryFile = path.join(platformDataDir, 'parent-inquiries.json');
const parentInquiryDir = path.dirname(parentInquiryFile);
const parentAdminUser = process.env.PARENT_LEADS_ADMIN_USER || 'admin';
const parentAdminPassword = process.env.PARENT_LEADS_ADMIN_PASSWORD || 'change-me';
const fllHubDir = path.join(__dirname, 'robotics lab', 'FLL Teams', '2026-2027-bioglow');
const fllSeedDataDir = path.join(fllHubDir, 'data');
const fllHubDataDir = process.env.FLL_DATA_DIR || path.join(platformDataDir, 'fll-hub', '2026-2027-bioglow', 'data');
const fllUsersFile = path.join(fllHubDataDir, 'fll-users.json');
const fllAssignmentsFile = path.join(fllHubDataDir, 'assignments.json');
const fllTasksFile = path.join(fllHubDataDir, 'tasks.json');
const fllMilestonesFile = path.join(fllHubDataDir, 'milestones.json');
const fllWorkLogsFile = path.join(fllHubDataDir, 'work-logs.json');
const fllTeamMembersFile = path.join(fllHubDataDir, 'team-members.json');
const fllTeamSchedulesFile = path.join(fllHubDataDir, 'team-schedules.json');
const fllSeasonSectionsFile = path.join(fllHubDataDir, 'season-sections.json');
const fllMissionAnalysisFile = path.join(fllHubDataDir, 'mission-analysis.json');
const fllSessionCookie = 'fll_session';
const fllDataFileNames = [
	'fll-users.json',
	'assignments.json',
	'tasks.json',
	'milestones.json',
	'work-logs.json',
	'team-members.json',
	'team-schedules.json',
	'season-sections.json',
	'mission-analysis.json',
	'season.json',
	'teams.json',
	'timeline.json',
	'announcements.json',
	'resources.json'
];
const fllSessions = new Map();
const campHubDir = path.join(__dirname, 'robotics lab', 'Summer Camp', '2026-summer-camp');
const campSeedDataDir = path.join(campHubDir, 'data');
const campHubDataDir = process.env.CAMP_DATA_DIR || path.join(platformDataDir, 'camp-hub', '2026-summer-camp', 'data');
const campUsersFile = path.join(campHubDataDir, 'camp-users.json');
const campCurriculumFile = path.join(campHubDataDir, 'curriculum.json');
const campAnnouncementsFile = path.join(campHubDataDir, 'announcements.json');
const campSubmissionsFile = path.join(campHubDataDir, 'submissions.json');
const campPrintRequestsFile = path.join(campHubDataDir, 'print-requests.json');
const campPointEventsFile = path.join(campHubDataDir, 'point-events.json');
const campClassroomFile = path.join(campHubDataDir, 'classroom-state.json');
const campSessionCookie = 'camp_session';
const campDataFileNames = [
	'camp-users.json',
	'camp.json',
	'curriculum.json',
	'announcements.json',
	'resources.json',
	'submissions.json',
	'print-requests.json',
	'point-events.json',
	'classroom-state.json'
];
const campSessions = new Map();
const coachUsersFile = path.join(platformDataDir, 'coach-users.json');
const coachSessionCookie = 'coach_session';
const coachSessions = new Map();
const masterRosterFile = path.join(platformDataDir, 'master-roster.json');
const regularCoachHubs = [
	'master-roster',
	'summer-curriculum',
	'fll-competitive-curriculum',
	'ftc-curriculum',
	'fll-hub',
	'camp-hub',
	'code-lab-admin'
];
const adminCoachHubs = [...regularCoachHubs, 'payments-admin', 'parent-leads-admin', 'summer-leads-admin'];
const coachHubDefinitions = {
	'master-roster': {
		id: 'master-roster',
		title: 'Master Roster',
		category: 'Operations',
		description: 'Create classes, manage students, and track summer weekly signups across programs.',
		targetUrl: '/master-roster',
		grant: 'master-roster'
	},
	'summer-curriculum': {
		id: 'summer-curriculum',
		title: 'Summer Curriculum',
		category: 'Curriculum',
		description: 'Open the summer camp schedule editor with weekly lesson plans, builds, and coach notes.',
		targetUrl: '/camp-hub/coach',
		grant: 'summer-curriculum'
	},
	'fll-competitive-curriculum': {
		id: 'fll-competitive-curriculum',
		title: 'FLL Competitive Curriculum',
		category: 'Curriculum',
		description: 'Review the FLL competitive curriculum timeline, assignments, and challenge prep.',
		targetUrl: '/fll-hub/curriculum',
		grant: 'fll-competitive-curriculum'
	},
	'ftc-curriculum': {
		id: 'ftc-curriculum',
		title: 'FTC Curriculum',
		category: 'Curriculum',
		description: 'Access the FTC coaching roadmap for robot engineering, Java, CAD, controls, and judging.',
		targetUrl: '/ftc-curriculum',
		grant: 'ftc-curriculum'
	},
	'fll-hub': {
		id: 'fll-hub',
		title: 'FLL Hub',
		category: 'Competition',
		description: 'Season dashboard, coach tools, curriculum, rosters, assignments, and FLL team resources.',
		targetUrl: '/fll-hub/coach',
		grant: 'fll-hub'
	},
	'camp-hub': {
		id: 'camp-hub',
		title: 'Summer Camp Hub',
		category: 'Programs',
		description: 'Camp schedule, announcements, curriculum notes, camper roster, and coach prep tools.',
		targetUrl: '/camp-hub/coach',
		grant: 'camp-hub'
	},
	'code-lab-admin': {
		id: 'code-lab-admin',
		title: 'Code Lab Backend',
		category: 'Learning Platform',
		description: 'Student accounts, progress, support tickets, activity, and live classroom monitoring.',
		targetUrl: '/admin',
		grant: 'code-lab-admin'
	},
	'payments-admin': {
		id: 'payments-admin',
		title: 'Payments Admin',
		category: 'Admin',
		description: 'Registration and membership payment records for owner/admin review.',
		targetUrl: '/payments-admin',
		grant: 'payments-admin',
		adminOnly: true
	},
	'parent-leads-admin': {
		id: 'parent-leads-admin',
		title: 'Parent Leads',
		category: 'Admin',
		description: 'Parent inquiries from the main website contact and program interest forms.',
		targetUrl: '/parent-leads-admin',
		grant: 'parent-leads-admin',
		adminOnly: true
	},
	'summer-leads-admin': {
		id: 'summer-leads-admin',
		title: 'Summer Leads',
		category: 'Admin',
		description: 'Summer camp ad leads, inquiry exports, and landing page traffic stats.',
		targetUrl: '/summer-leads-admin',
		grant: 'summer-leads-admin',
		adminOnly: true
	}
};

// Payments routes MUST mount before global express.json() — the Stripe webhook
// endpoint needs the raw request body to verify the signature.
payments.mount(app, express, { isUnifiedCoachAdmin: isCoachAdminRequest });

app.use(express.json({ limit: '12mb' }));
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

app.get(['/coach-login', '/coach-login/'], async (req, res) => {
	const user = await getCoachUserFromSession(req);
	if (user) {
		return res.redirect(302, '/coach-portal');
	}
	return res.sendFile(path.join(__dirname, 'coach-login.html'));
});

app.get(['/coach-portal', '/coach-portal/'], requireCoachPortalAuth, (req, res) => {
	return res.sendFile(path.join(__dirname, 'coach-portal.html'));
});

app.post('/api/coach/login', async (req, res) => {
	try {
		const username = cleanMetaString(req.body.username || '', 80).toLowerCase();
		const password = typeof req.body.password === 'string' ? req.body.password : '';
		const users = await readCoachUsers();
		const user = users.find((candidate) => String(candidate.username || '').toLowerCase() === username && candidate.active !== false);

		if (!user || !verifyScryptPassword(password, user.password_hash)) {
			return res.status(401).json({ success: false, message: 'Invalid coach username or password' });
		}

		const token = crypto.randomBytes(32).toString('hex');
		coachSessions.set(token, {
			userId: user.id,
			hubs: Array.isArray(user.hubs) ? user.hubs : [],
			createdAt: Date.now(),
			lastSeen: Date.now()
		});
		setCoachSessionCookie(res, token);
		return res.json({
			success: true,
			user: publicCoachUser(user),
			hubs: coachVisibleHubs(user),
			redirectTo: '/coach-portal'
		});
	} catch (err) {
		console.error('Coach login error:', err);
		return res.status(500).json({ success: false, message: 'Server error signing in' });
	}
});

app.post('/api/coach/logout', (req, res) => {
	const session = getCoachSession(req);
	if (session) {
		coachSessions.delete(session.token);
	}
	clearCoachSessionCookie(res);
	return res.json({ success: true });
});

app.get('/api/coach/session', requireCoachPortalAuth, (req, res) => {
	return res.json({
		success: true,
		user: publicCoachUser(req.coachUser),
		hubs: coachVisibleHubs(req.coachUser)
	});
});

app.post('/api/coach/open/:hubId', requireCoachPortalAuth, async (req, res, next) => {
	try {
		const hub = coachHubDefinitions[req.params.hubId];
		if (!hub) {
			return res.status(404).json({ success: false, message: 'Hub not found' });
		}
		if (!coachHasHub(req.coachUser, hub.grant)) {
			return res.status(403).json({ success: false, message: 'You do not have access to this hub' });
		}

		if (hub.id === 'fll-hub' || hub.id === 'fll-competitive-curriculum') {
			const fllUsers = await readFllUsers();
			const fllUser = fllUsers.find((candidate) => {
				if (req.coachUser.fllUserId && candidate.id === req.coachUser.fllUserId) return true;
				return String(candidate.username || '').toLowerCase() === String(req.coachUser.fllUsername || req.coachUser.username || '').toLowerCase();
			});
			if (!fllUser || fllUser.role !== 'coach' || fllUser.active === false) {
				return res.status(404).json({ success: false, message: 'Matching FLL coach account not found' });
			}
			createFllSessionForUser(res, fllUser);
			return res.json({ success: true, url: hub.targetUrl });
		}

		if (hub.id === 'camp-hub' || hub.id === 'summer-curriculum') {
			const campUsers = await readCampUsers();
			const campUser = campUsers.find((candidate) => {
				if (req.coachUser.campUserId && candidate.id === req.coachUser.campUserId) return true;
				return String(candidate.username || '').toLowerCase() === String(req.coachUser.campUsername || req.coachUser.username || '').toLowerCase();
			});
			if (!campUser || campUser.role !== 'coach' || campUser.active === false) {
				return res.status(404).json({ success: false, message: 'Matching camp coach account not found' });
			}
			createCampSessionForUser(res, campUser);
			return res.json({ success: true, url: hub.targetUrl });
		}

		if (hub.id === 'code-lab-admin') {
			req.url = '/api/internal/coach-login';
			req.headers['x-coach-bridge-secret'] = codeLabApp.coachBridgeSecret;
			req.body = {
				coach: publicCoachUser(req.coachUser),
				redirectTo: hub.targetUrl
			};
			return codeLabApp(req, res, next);
		}

		return res.json({ success: true, url: hub.targetUrl });
	} catch (err) {
		console.error('Coach hub open error:', err);
		return res.status(500).json({ success: false, message: 'Server error opening hub' });
	}
});

app.get(['/master-roster', '/master-roster/'], requireCoachPortalAuth, (req, res) => {
	return res.sendFile(path.join(__dirname, 'master-roster.html'));
});

app.get(['/ftc-curriculum', '/ftc-curriculum/'], requireCoachPortalAuth, (req, res) => {
	return res.sendFile(path.join(__dirname, 'ftc-curriculum.html'));
});

app.get('/api/master-roster', requireCoachPortalAuth, async (req, res) => {
	try {
		const roster = await readMasterRoster();
		return res.json({ success: true, data: publicMasterRoster(roster) });
	} catch (err) {
		console.error('Master roster load error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading master roster' });
	}
});

app.post('/api/master-roster/classes', requireCoachPortalAuth, async (req, res) => {
	try {
		const roster = await readMasterRoster();
		const classItem = sanitizeMasterClassPayload(req.body || {});
		if (!classItem) {
			return res.status(400).json({ success: false, message: 'Class name is required' });
		}
		roster.classes.push({ ...classItem, createdAt: new Date().toISOString() });
		await writeMasterRoster(roster);
		return res.status(201).json({ success: true, data: publicMasterRoster(roster), class: classItem });
	} catch (err) {
		console.error('Master class create error:', err);
		return res.status(500).json({ success: false, message: 'Server error creating class' });
	}
});

app.patch('/api/master-roster/classes/:id', requireCoachPortalAuth, async (req, res) => {
	try {
		const roster = await readMasterRoster();
		const index = roster.classes.findIndex((item) => item.id === req.params.id);
		if (index === -1) {
			return res.status(404).json({ success: false, message: 'Class not found' });
		}
		const update = sanitizeMasterClassPayload(req.body || {}, roster.classes[index].id);
		if (!update) {
			return res.status(400).json({ success: false, message: 'Class name is required' });
		}
		roster.classes[index] = {
			...roster.classes[index],
			...update,
			updatedAt: new Date().toISOString()
		};
		for (const student of roster.students) {
			student.enrollments = normalizeMasterEnrollments(student.enrollments, roster.classes, roster.settings.summerWeeks);
		}
		await writeMasterRoster(roster);
		return res.json({ success: true, data: publicMasterRoster(roster), class: roster.classes[index] });
	} catch (err) {
		console.error('Master class update error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating class' });
	}
});

app.delete('/api/master-roster/classes/:id', requireCoachPortalAuth, async (req, res) => {
	try {
		const roster = await readMasterRoster();
		const before = roster.classes.length;
		roster.classes = roster.classes.filter((item) => item.id !== req.params.id);
		if (roster.classes.length === before) {
			return res.status(404).json({ success: false, message: 'Class not found' });
		}
		for (const student of roster.students) {
			student.enrollments = (Array.isArray(student.enrollments) ? student.enrollments : [])
				.filter((enrollment) => enrollment.classId !== req.params.id);
			student.updatedAt = new Date().toISOString();
		}
		await writeMasterRoster(roster);
		return res.json({ success: true, data: publicMasterRoster(roster) });
	} catch (err) {
		console.error('Master class delete error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting class' });
	}
});

app.post('/api/master-roster/students', requireCoachPortalAuth, async (req, res) => {
	try {
		const roster = await readMasterRoster();
		const student = sanitizeMasterStudentPayload(req.body || {}, roster);
		if (!student) {
			return res.status(400).json({ success: false, message: 'Student name is required' });
		}
		roster.students.push(student);
		await writeMasterRoster(roster);
		return res.status(201).json({ success: true, data: publicMasterRoster(roster), student });
	} catch (err) {
		console.error('Master student create error:', err);
		return res.status(500).json({ success: false, message: 'Server error creating student' });
	}
});

app.patch('/api/master-roster/students/:id', requireCoachPortalAuth, async (req, res) => {
	try {
		const roster = await readMasterRoster();
		const index = roster.students.findIndex((item) => item.id === req.params.id);
		if (index === -1) {
			return res.status(404).json({ success: false, message: 'Student not found' });
		}
		const student = sanitizeMasterStudentPayload(req.body || {}, roster, roster.students[index]);
		if (!student) {
			return res.status(400).json({ success: false, message: 'Student name is required' });
		}
		roster.students[index] = student;
		await writeMasterRoster(roster);
		return res.json({ success: true, data: publicMasterRoster(roster), student });
	} catch (err) {
		console.error('Master student update error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating student' });
	}
});

app.delete('/api/master-roster/students/:id', requireCoachPortalAuth, async (req, res) => {
	try {
		const roster = await readMasterRoster();
		const before = roster.students.length;
		roster.students = roster.students.filter((item) => item.id !== req.params.id);
		if (roster.students.length === before) {
			return res.status(404).json({ success: false, message: 'Student not found' });
		}
		await writeMasterRoster(roster);
		return res.json({ success: true, data: publicMasterRoster(roster) });
	} catch (err) {
		console.error('Master student delete error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting student' });
	}
});

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

async function readSummerTraffic() {
	try {
		const raw = await fs.readFile(summerTrafficFile, 'utf8');
		const parsed = JSON.parse(raw);
		return {
			totalVisits: Number.isFinite(parsed.totalVisits) ? parsed.totalVisits : 0,
			totalPageViews: Number.isFinite(parsed.totalPageViews) ? parsed.totalPageViews : 0,
			sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {}
		};
	} catch (readErr) {
		if (readErr.code === 'ENOENT') {
			return { totalVisits: 0, totalPageViews: 0, sessions: {} };
		}
		throw readErr;
	}
}

async function writeSummerTraffic(data) {
	await fs.mkdir(summerTrafficDir, { recursive: true });
	await fs.writeFile(summerTrafficFile, JSON.stringify(data, null, 2));
}

function toCsvValue(value) {
	const normalized = value == null ? '' : String(value);
	return `"${normalized.replace(/"/g, '""')}"`;
}

function sha256(value) {
	return crypto.createHash('sha256').update(value).digest('hex');
}

function hashScryptPassword(password) {
	const salt = crypto.randomBytes(16).toString('hex');
	const hash = crypto.scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

function verifyScryptPassword(password, stored) {
	if (!password || !stored || typeof stored !== 'string') return false;
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
	return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
}

function parseCookies(req) {
	return String(req.headers.cookie || '')
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.reduce((cookies, part) => {
			const separatorIndex = part.indexOf('=');
			if (separatorIndex === -1) return cookies;
			const key = decodeURIComponent(part.slice(0, separatorIndex));
			const value = decodeURIComponent(part.slice(separatorIndex + 1));
			cookies[key] = value;
			return cookies;
		}, {});
}

function setFllSessionCookie(res, token) {
	const maxAge = 7 * 24 * 60 * 60;
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
	res.setHeader('Set-Cookie', `${fllSessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function clearFllSessionCookie(res) {
	res.setHeader('Set-Cookie', `${fllSessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function getFllSession(req) {
	const token = parseCookies(req)[fllSessionCookie];
	if (!token) return null;
	const session = fllSessions.get(token);
	if (!session) return null;
	if (Date.now() - session.lastSeen > 7 * 24 * 60 * 60 * 1000) {
		fllSessions.delete(token);
		return null;
	}
	session.lastSeen = Date.now();
	return { token, ...session };
}

function publicFllUser(user) {
	if (!user) return null;
	return {
		id: user.id,
		name: user.name,
		username: user.username,
		role: user.role,
		teamId: user.teamId || null
	};
}

async function readJsonFile(filePath, fallback) {
	try {
		const raw = await fs.readFile(filePath, 'utf8');
		return JSON.parse(raw);
	} catch (err) {
		if (err.code === 'ENOENT') return fallback;
		throw err;
	}
}

async function writeJsonFile(filePath, data) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function initializeFllDataDir() {
	await fs.mkdir(fllHubDataDir, { recursive: true });
	await Promise.all(fllDataFileNames.map(async (fileName) => {
		const targetFile = path.join(fllHubDataDir, fileName);
		try {
			await fs.access(targetFile);
		} catch (err) {
			if (err.code !== 'ENOENT') throw err;
			const seedFile = path.join(fllSeedDataDir, fileName);
			try {
				await fs.copyFile(seedFile, targetFile);
			} catch (copyErr) {
				if (copyErr.code !== 'ENOENT') throw copyErr;
				await fs.writeFile(targetFile, '[]');
			}
		}
	}));
}

async function readFllUsers() {
	const users = await readJsonFile(fllUsersFile, []);
	return Array.isArray(users) ? users : [];
}

function setCampSessionCookie(res, token) {
	const maxAge = 7 * 24 * 60 * 60;
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
	res.setHeader('Set-Cookie', `${campSessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function clearCampSessionCookie(res) {
	res.setHeader('Set-Cookie', `${campSessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function getCampSession(req) {
	const token = parseCookies(req)[campSessionCookie];
	if (!token) return null;
	const session = campSessions.get(token);
	if (!session) return null;
	if (Date.now() - session.lastSeen > 7 * 24 * 60 * 60 * 1000) {
		campSessions.delete(token);
		return null;
	}
	session.lastSeen = Date.now();
	return { token, ...session };
}

function publicCampUser(user) {
	if (!user) return null;
	return {
		id: user.id,
		name: user.name,
		username: user.username,
		role: user.role,
		className: user.className || 'Unassigned'
	};
}

async function initializeCampDataDir() {
	await fs.mkdir(campHubDataDir, { recursive: true });
	await Promise.all(campDataFileNames.map(async (fileName) => {
		const targetFile = path.join(campHubDataDir, fileName);
		try {
			await fs.access(targetFile);
		} catch (err) {
			if (err.code !== 'ENOENT') throw err;
			const seedFile = path.join(campSeedDataDir, fileName);
			try {
				await fs.copyFile(seedFile, targetFile);
			} catch (copyErr) {
				if (copyErr.code !== 'ENOENT') throw copyErr;
				await fs.writeFile(targetFile, '[]');
			}
		}
	}));
}

async function readCampUsers() {
	const users = await readJsonFile(campUsersFile, []);
	return Array.isArray(users) ? users : [];
}

async function readCampSubmissions() {
	const submissions = await readJsonFile(campSubmissionsFile, []);
	return Array.isArray(submissions) ? submissions : [];
}

async function readCampPrintRequests() {
	const requests = await readJsonFile(campPrintRequestsFile, []);
	return Array.isArray(requests) ? requests : [];
}

async function readCampPointEvents() {
	const events = await readJsonFile(campPointEventsFile, []);
	return Array.isArray(events) ? events : [];
}

function defaultCampClassroomState() {
	return {
		noiseLevel: 'partner',
		timer: {
			label: 'Work time',
			durationMinutes: 20,
			startedAt: '',
			pausedRemainingSeconds: 20 * 60,
			running: false
		},
		groups: []
	};
}

function normalizeCampClassroomState(state) {
	const fallback = defaultCampClassroomState();
	const source = state && typeof state === 'object' ? state : {};
	const timerSource = source.timer && typeof source.timer === 'object' ? source.timer : {};
	return {
		noiseLevel: ['silent', 'whisper', 'partner', 'team', 'present'].includes(source.noiseLevel) ? source.noiseLevel : fallback.noiseLevel,
		timer: {
			label: cleanMetaString(timerSource.label || fallback.timer.label, 80),
			durationMinutes: Number.isFinite(timerSource.durationMinutes) ? timerSource.durationMinutes : fallback.timer.durationMinutes,
			startedAt: cleanMetaString(timerSource.startedAt || '', 80),
			pausedRemainingSeconds: Number.isFinite(timerSource.pausedRemainingSeconds) ? Math.max(0, Math.round(timerSource.pausedRemainingSeconds)) : fallback.timer.pausedRemainingSeconds,
			running: timerSource.running === true
		},
		groups: Array.isArray(source.groups) ? source.groups.map((group) => ({
			id: cleanMetaString(group.id || `group-${crypto.randomBytes(3).toString('hex')}`, 120),
			name: cleanMetaString(group.name || 'Group', 120),
			focus: cleanMetaString(group.focus || '', 240),
			members: Array.isArray(group.members) ? group.members.map((member) => cleanMetaString(member, 80)).filter(Boolean).slice(0, 30) : [],
			subgroups: Array.isArray(group.subgroups) ? group.subgroups.map((subgroup) => ({
				id: cleanMetaString(subgroup.id || `subgroup-${crypto.randomBytes(3).toString('hex')}`, 120),
				name: cleanMetaString(subgroup.name || 'Subgroup', 120),
				members: Array.isArray(subgroup.members) ? subgroup.members.map((member) => cleanMetaString(member, 80)).filter(Boolean).slice(0, 30) : []
			})).slice(0, 12) : []
		})).slice(0, 20) : []
	};
}

async function readCampClassroomState() {
	return normalizeCampClassroomState(await readJsonFile(campClassroomFile, defaultCampClassroomState()));
}

function campPointsFor(studentId, submissions, printRequests, pointEvents = []) {
	const submittedActivities = (Array.isArray(submissions) ? submissions : [])
		.filter((item) => item.studentId === studentId).length;
	const printBonus = (Array.isArray(printRequests) ? printRequests : [])
		.filter((item) => item.studentId === studentId)
		.reduce((sum, item) => sum + (Number.isFinite(item.pointsAwarded) ? item.pointsAwarded : 0), 0);
	const manualEvents = (Array.isArray(pointEvents) ? pointEvents : []).filter((item) => item.studentId === studentId);
	const behaviorPoints = manualEvents.reduce((sum, item) => sum + (Number.isFinite(item.points) ? item.points : 0), 0);
	const skills = manualEvents.reduce((acc, item) => {
		const key = item.category || 'Other';
		acc[key] = (acc[key] || 0) + (Number.isFinite(item.points) ? item.points : 0);
		return acc;
	}, {});
	return {
		total: submittedActivities * 10 + printBonus + behaviorPoints,
		submittedActivities,
		activityPoints: submittedActivities * 10,
		printBonus,
		behaviorPoints,
		skills,
		events: manualEvents
			.slice()
			.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
			.slice(0, 12)
	};
}

async function readCoachUsers() {
	const users = await readJsonFile(coachUsersFile, []);
	return Array.isArray(users) ? users : [];
}

async function initializeCoachDataDir() {
	await fs.mkdir(path.dirname(coachUsersFile), { recursive: true });
	try {
		await fs.access(coachUsersFile);
		return;
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
	}

	const [fllUsers, campUsers] = await Promise.all([readFllUsers(), readCampUsers()]);
	const fllCoachUsers = fllUsers.filter((user) => user.role === 'coach' && user.active !== false);
	const campCoachUsers = campUsers.filter((user) => user.role === 'coach' && user.active !== false);
	const campByUsername = new Map(campCoachUsers.map((user) => [String(user.username || '').toLowerCase(), user]));
	const sharedFllCoachUsers = fllCoachUsers.filter((fllUser) => campByUsername.has(String(fllUser.username || '').toLowerCase()));
	const sourceFllCoachUsers = sharedFllCoachUsers.length ? sharedFllCoachUsers : fllCoachUsers;
	const seededUsers = sourceFllCoachUsers.map((fllUser) => {
		const username = String(fllUser.username || '').toLowerCase();
		const isOwner = username === 'giovanny';
		const campUser = campByUsername.get(username) || null;
		return {
			id: `coach-${username}`,
			name: fllUser.name,
			username,
			password_hash: fllUser.password_hash,
			role: isOwner ? 'owner' : 'coach',
			hubs: isOwner ? adminCoachHubs : regularCoachHubs,
			fllUserId: fllUser.id,
			fllUsername: fllUser.username,
			campUserId: campUser?.id || null,
			campUsername: campUser?.username || username,
			active: true
		};
	});

	const defaultFllCoach = fllCoachUsers.find((user) => String(user.username || '').toLowerCase() === 'coach');
	const defaultCampCoach = campByUsername.get('campcoach');
	if (defaultFllCoach && defaultCampCoach && !seededUsers.some((user) => user.username === 'coach')) {
		seededUsers.push({
			id: 'coach-test',
			name: 'Test Coach',
			username: 'coach',
			password_hash: defaultFllCoach.password_hash,
			role: 'coach',
			hubs: regularCoachHubs,
			fllUserId: defaultFllCoach.id,
			fllUsername: defaultFllCoach.username,
			campUserId: defaultCampCoach.id,
			campUsername: defaultCampCoach.username,
			active: true
		});
	}

	if (!sharedFllCoachUsers.length) {
		for (const campUser of campCoachUsers) {
			const username = String(campUser.username || '').toLowerCase();
			if (seededUsers.some((user) => user.username === username)) continue;
			seededUsers.push({
				id: `coach-${username}`,
				name: campUser.name,
				username,
				password_hash: campUser.password_hash,
				role: 'coach',
				hubs: ['camp-hub', 'code-lab-admin'],
				fllUserId: null,
				fllUsername: username,
				campUserId: campUser.id,
				campUsername: campUser.username,
				active: true
			});
		}
	}

	if (!seededUsers.length) {
		seededUsers.push({
			id: 'coach-owner',
			name: 'Owner Admin',
			username: 'owner',
			password_hash: hashScryptPassword(process.env.COACH_OWNER_PASSWORD || 'change-me'),
			role: 'owner',
			hubs: adminCoachHubs,
			fllUserId: null,
			fllUsername: null,
			campUserId: null,
			campUsername: null,
			active: true
		});
	}

	await writeJsonFile(coachUsersFile, seededUsers);
}

function setCoachSessionCookie(res, token) {
	const maxAge = 7 * 24 * 60 * 60;
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
	res.setHeader('Set-Cookie', `${coachSessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

function clearCoachSessionCookie(res) {
	res.setHeader('Set-Cookie', `${coachSessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function getCoachSession(req) {
	const token = parseCookies(req)[coachSessionCookie];
	if (!token) return null;
	const session = coachSessions.get(token);
	if (!session) return null;
	if (Date.now() - session.lastSeen > 7 * 24 * 60 * 60 * 1000) {
		coachSessions.delete(token);
		return null;
	}
	session.lastSeen = Date.now();
	return { token, ...session };
}

function publicCoachUser(user) {
	if (!user) return null;
	return {
		id: user.id,
		name: user.name,
		username: user.username,
		role: user.role === 'owner' ? 'owner' : 'coach'
	};
}

function coachHasHub(user, hubId) {
	return Boolean(user && Array.isArray(user.hubs) && user.hubs.includes(hubId));
}

function coachVisibleHubs(user) {
	return Object.values(coachHubDefinitions)
		.filter((hub) => coachHasHub(user, hub.grant))
		.map((hub) => ({
			id: hub.id,
			title: hub.title,
			category: hub.category,
			description: hub.description,
			adminOnly: Boolean(hub.adminOnly)
		}));
}

async function getCoachUserFromSession(req) {
	const session = getCoachSession(req);
	if (!session) return null;
	const users = await readCoachUsers();
	const user = users.find((candidate) => candidate.id === session.userId && candidate.active !== false);
	if (!user) {
		coachSessions.delete(session.token);
		return null;
	}
	return user;
}

function isCoachAdminRequest(req) {
	const session = getCoachSession(req);
	if (!session) return false;
	return Array.isArray(session.hubs)
		&& session.hubs.includes('payments-admin')
		&& session.hubs.includes('parent-leads-admin')
		&& session.hubs.includes('summer-leads-admin');
}

async function requireCoachPortalAuth(req, res, next) {
	try {
		const user = await getCoachUserFromSession(req);
		if (!user) {
			if (req.path.startsWith('/api/')) {
				return res.status(401).json({ success: false, message: 'Coach login required' });
			}
			return res.redirect(302, '/coach-login');
		}
		req.coachUser = user;
		return next();
	} catch (err) {
		console.error('Coach portal auth error:', err);
		return res.status(500).json({ success: false, message: 'Server error checking coach session' });
	}
}

async function requireCoachAdmin(req, res, next) {
	try {
		const user = await getCoachUserFromSession(req);
		if (user && coachHasHub(user, 'parent-leads-admin') && coachHasHub(user, 'summer-leads-admin')) {
			req.coachUser = user;
			return next();
		}
		return next();
	} catch (err) {
		console.error('Coach admin auth error:', err);
		return next();
	}
}

function createFllSessionForUser(res, user) {
	const token = crypto.randomBytes(32).toString('hex');
	fllSessions.set(token, {
		userId: user.id,
		createdAt: Date.now(),
		lastSeen: Date.now()
	});
	setFllSessionCookie(res, token);
}

function createCampSessionForUser(res, user) {
	const token = crypto.randomBytes(32).toString('hex');
	campSessions.set(token, {
		userId: user.id,
		createdAt: Date.now(),
		lastSeen: Date.now()
	});
	setCampSessionCookie(res, token);
}

function buildDefaultMasterRoster() {
	const summerWeeks = [
		{ id: 'week-1', label: 'Week 1', dates: 'July 6-11, 2026' },
		{ id: 'week-2', label: 'Week 2', dates: 'July 13-18, 2026' },
		{ id: 'week-3', label: 'Week 3', dates: 'July 20-25, 2026' },
		{ id: 'week-4', label: 'Week 4', dates: 'July 27-Aug 1, 2026' },
		{ id: 'week-5', label: 'Week 5', dates: 'Aug 3-8, 2026' },
		{ id: 'week-6', label: 'Week 6', dates: 'Aug 10-15, 2026' },
		{ id: 'week-7', label: 'Week 7', dates: 'Aug 17-22, 2026' },
		{ id: 'week-8', label: 'Week 8', dates: 'Aug 24-29, 2026' },
		{ id: 'week-9', label: 'Week 9', dates: 'Aug 31-Sep 5, 2026' }
	];
	const now = new Date().toISOString();
	return {
		version: 1,
		updatedAt: now,
		settings: { summerWeeks },
		classes: [
			{ id: 'summer-lego-robotics-1', term: 'summer', program: 'lego-robotics', name: 'Summer LEGO Robotics 1', day: 'Weekly', schedule: 'Summer camp weekly enrollment', active: true, createdAt: now },
			{ id: 'summer-lego-robotics-2', term: 'summer', program: 'lego-robotics', name: 'Summer LEGO Robotics 2', day: 'Weekly', schedule: 'Summer camp weekly enrollment', active: true, createdAt: now },
			{ id: 'summer-ftc', term: 'summer', program: 'ftc', name: 'Summer FTC Robotics', day: 'Weekly', schedule: 'Summer camp weekly enrollment', active: true, createdAt: now },
			{ id: 'fall-sat-lego-robotics-1', term: 'fall', program: 'lego-robotics', name: 'Fall Saturday LEGO Robotics 1', day: 'Saturday', schedule: 'Saturday class', active: true, createdAt: now },
			{ id: 'fall-sat-lego-robotics-2', term: 'fall', program: 'lego-robotics', name: 'Fall Saturday LEGO Robotics 2', day: 'Saturday', schedule: 'Saturday class', active: true, createdAt: now },
			{ id: 'fall-sat-ftc', term: 'fall', program: 'ftc', name: 'Fall Saturday FTC Robotics', day: 'Saturday', schedule: 'Saturday class', active: true, createdAt: now },
			{ id: 'fall-sun-lego-robotics-1', term: 'fall', program: 'lego-robotics', name: 'Fall Sunday LEGO Robotics 1', day: 'Sunday', schedule: 'Sunday class', active: true, createdAt: now },
			{ id: 'fall-sun-lego-robotics-2', term: 'fall', program: 'lego-robotics', name: 'Fall Sunday LEGO Robotics 2', day: 'Sunday', schedule: 'Sunday class', active: true, createdAt: now },
			{ id: 'fall-sun-ftc', term: 'fall', program: 'ftc', name: 'Fall Sunday FTC Robotics', day: 'Sunday', schedule: 'Sunday class', active: true, createdAt: now }
		],
		students: []
	};
}

function normalizeMasterRoster(data) {
	const fallback = buildDefaultMasterRoster();
	const source = data && typeof data === 'object' ? data : {};
	return {
		version: 1,
		updatedAt: source.updatedAt || fallback.updatedAt,
		settings: {
			summerWeeks: Array.isArray(source.settings?.summerWeeks) ? source.settings.summerWeeks : fallback.settings.summerWeeks
		},
		classes: Array.isArray(source.classes) ? source.classes : fallback.classes,
		students: Array.isArray(source.students) ? source.students : []
	};
}

async function initializeMasterRoster() {
	try {
		await fs.access(masterRosterFile);
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
		await writeJsonFile(masterRosterFile, buildDefaultMasterRoster());
	}
}

async function readMasterRoster() {
	return normalizeMasterRoster(await readJsonFile(masterRosterFile, buildDefaultMasterRoster()));
}

async function writeMasterRoster(roster) {
	await writeJsonFile(masterRosterFile, {
		...normalizeMasterRoster(roster),
		updatedAt: new Date().toISOString()
	});
}

function publicMasterRoster(roster) {
	const normalized = normalizeMasterRoster(roster);
	return {
		...normalized,
		students: normalized.students.map((student) => ({
			id: student.id,
			name: student.name,
			parentName: student.parentName || '',
			email: student.email || '',
			phone: student.phone || '',
			notes: student.notes || '',
			active: student.active !== false,
			enrollments: Array.isArray(student.enrollments) ? student.enrollments : [],
			createdAt: student.createdAt || '',
			updatedAt: student.updatedAt || ''
		}))
	};
}

function sanitizeMasterClassPayload(body, existingId = '') {
	const name = cleanMetaString(body.name || '', 100);
	const term = ['summer', 'fall', 'spring', 'year-round'].includes(body.term) ? body.term : 'fall';
	const program = ['lego-robotics', 'ftc', 'fll', 'code-lab', 'other'].includes(body.program) ? body.program : 'lego-robotics';
	const day = cleanMetaString(body.day || '', 40) || (term === 'summer' ? 'Weekly' : 'Saturday');
	const schedule = cleanMetaString(body.schedule || '', 160);
	if (!name) return null;
	return {
		id: existingId || `${term}-${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`,
		term,
		program,
		name,
		day,
		schedule,
		active: body.active !== false
	};
}

function normalizeMasterEnrollments(rawEnrollments, classes, summerWeeks) {
	const classById = new Map(classes.map((item) => [item.id, item]));
	const validWeeks = new Set(summerWeeks.map((week) => week.id));
	const source = Array.isArray(rawEnrollments) ? rawEnrollments : [];
	const byClass = new Map();
	for (const item of source) {
		const classId = cleanMetaString(item.classId || '', 120);
		const classItem = classById.get(classId);
		if (!classItem) continue;
		const weeks = classItem.term === 'summer' && Array.isArray(item.weeks)
			? Array.from(new Set(item.weeks.filter((weekId) => validWeeks.has(weekId))))
			: [];
		byClass.set(classId, { classId, weeks });
	}
	return Array.from(byClass.values());
}

function sanitizeMasterStudentPayload(body, roster, existing = {}) {
	const name = cleanMetaString(body.name || existing.name || '', 120);
	if (!name) return null;
	const now = new Date().toISOString();
	return {
		id: existing.id || `student-${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`,
		name,
		parentName: cleanMetaString(body.parentName ?? existing.parentName ?? '', 120),
		email: cleanMetaString(body.email ?? existing.email ?? '', 180),
		phone: cleanMetaString(body.phone ?? existing.phone ?? '', 80),
		notes: cleanMetaString(body.notes ?? existing.notes ?? '', 600),
		active: body.active !== false,
		enrollments: normalizeMasterEnrollments(body.enrollments ?? existing.enrollments ?? [], roster.classes, roster.settings.summerWeeks),
		createdAt: existing.createdAt || now,
		updatedAt: now
	};
}

async function requireCampAuth(req, res, next) {
	try {
		const session = getCampSession(req);
		if (!session) {
			if (req.path.startsWith('/api/')) {
				return res.status(401).json({ success: false, message: 'Camp login required' });
			}
			return res.redirect(302, '/camp-hub/login');
		}
		const users = await readCampUsers();
		const user = users.find((candidate) => candidate.id === session.userId && candidate.active !== false);
		if (!user) {
			campSessions.delete(session.token);
			clearCampSessionCookie(res);
			if (req.path.startsWith('/api/')) {
				return res.status(401).json({ success: false, message: 'Camp login required' });
			}
			return res.redirect(302, '/camp-hub/login');
		}
		req.campUser = user;
		return next();
	} catch (err) {
		console.error('Camp auth error:', err);
		return res.status(500).json({ success: false, message: 'Server error checking camp session' });
	}
}

function requireCampCoach(req, res, next) {
	if (!req.campUser || req.campUser.role !== 'coach') {
		return res.status(403).json({ success: false, message: 'Coach access required' });
	}
	return next();
}

function normalizedPersonName(value) {
	return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function weekRangeFor(week) {
	const days = (Array.isArray(week.days) ? week.days : []).map((day) => day.date).filter(Boolean).sort();
	return {
		start: days[0] || '',
		end: days[days.length - 1] || ''
	};
}

function parseMonthName(value) {
	const months = {
		jan: 1, january: 1,
		feb: 2, february: 2,
		mar: 3, march: 3,
		apr: 4, april: 4,
		may: 5,
		jun: 6, june: 6,
		jul: 7, july: 7,
		aug: 8, august: 8,
		sep: 9, sept: 9, september: 9,
		oct: 10, october: 10,
		nov: 11, november: 11,
		dec: 12, december: 12
	};
	return months[String(value || '').toLowerCase()] || null;
}

function isoDateFor(year, month, day) {
	if (!year || !month || !day) return '';
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseRosterWeekRange(week) {
	const dates = String(week?.dates || '');
	const yearMatch = dates.match(/(20\d{2})/);
	const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
	let match = dates.match(/([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)\s+(\d{1,2})/);
	if (match) {
		return {
			start: isoDateFor(year, parseMonthName(match[1]), Number(match[2])),
			end: isoDateFor(year, parseMonthName(match[3]), Number(match[4]))
		};
	}
	match = dates.match(/([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2})/);
	if (match) {
		const month = parseMonthName(match[1]);
		return {
			start: isoDateFor(year, month, Number(match[2])),
			end: isoDateFor(year, month, Number(match[3]))
		};
	}
	return { start: '', end: '' };
}

function rangesOverlap(a, b) {
	return Boolean(a?.start && a?.end && b?.start && b?.end && a.start <= b.end && b.start <= a.end);
}

function mapRosterWeeksToCurriculumWeekIds(rosterWeekIds, rosterWeeks, curriculumWeeks) {
	const rosterWeekById = new Map((Array.isArray(rosterWeeks) ? rosterWeeks : []).map((week) => [week.id, week]));
	const curriculumRanges = (Array.isArray(curriculumWeeks) ? curriculumWeeks : []).map((week) => ({
		id: week.id,
		range: weekRangeFor(week)
	}));
	const mapped = [];
	for (const rosterWeekId of rosterWeekIds) {
		const rosterRange = parseRosterWeekRange(rosterWeekById.get(rosterWeekId));
		const matches = curriculumRanges.filter((item) => rangesOverlap(rosterRange, item.range)).map((item) => item.id);
		mapped.push(...(matches.length ? matches : [rosterWeekId]));
	}
	return Array.from(new Set(mapped));
}

async function getCampEnrollmentForUser(user, curriculum) {
	const curriculumWeeks = Array.isArray(curriculum) ? curriculum : [];
	const validWeekIds = new Set(curriculumWeeks.map((week) => week.id));
	let source = 'fallback';
	let enrolledWeekIds = [];
	let masterStudent = null;
	let matchedMasterRoster = false;

	try {
		const roster = await readMasterRoster();
		const classesById = new Map((roster.classes || []).map((item) => [item.id, item]));
		const userName = normalizedPersonName(user.name);
		masterStudent = (roster.students || []).find((student) => {
			if (user.masterStudentId && student.id === user.masterStudentId) return true;
			return normalizedPersonName(student.name) === userName;
		});
		if (masterStudent) {
			matchedMasterRoster = true;
			const weeks = [];
			for (const enrollment of (Array.isArray(masterStudent.enrollments) ? masterStudent.enrollments : [])) {
				const classItem = classesById.get(enrollment.classId);
				if (classItem && classItem.term === 'summer') {
					weeks.push(...(Array.isArray(enrollment.weeks) ? enrollment.weeks : []));
				}
			}
			enrolledWeekIds = mapRosterWeeksToCurriculumWeekIds(weeks, roster.settings.summerWeeks, curriculumWeeks)
				.filter((weekId) => validWeekIds.has(weekId));
			source = 'master-roster';
		}
	} catch (err) {
		console.error('Camp enrollment lookup error:', err);
	}

	if (!enrolledWeekIds.length && !matchedMasterRoster && Array.isArray(user.enrolledWeekIds)) {
		enrolledWeekIds = Array.from(new Set(user.enrolledWeekIds.filter((weekId) => validWeekIds.has(weekId))));
		source = 'camp-user';
	}
	if (!enrolledWeekIds.length && !matchedMasterRoster) {
		enrolledWeekIds = curriculumWeeks.map((week) => week.id).filter(Boolean);
		source = 'fallback';
	}

	const today = new Date().toISOString().slice(0, 10);
	const enrolledWeeks = curriculumWeeks.filter((week) => enrolledWeekIds.includes(week.id));
	const visibleWeek = enrolledWeeks.find((week) => {
		const range = weekRangeFor(week);
		return range.start && range.end && today >= range.start && today <= range.end;
	}) || enrolledWeeks.find((week) => {
		const range = weekRangeFor(week);
		return range.start && today < range.start;
	}) || enrolledWeeks[enrolledWeeks.length - 1] || null;

	return {
		source,
		masterStudentId: masterStudent?.id || user.masterStudentId || null,
		enrolledWeekIds,
		visibleWeekId: visibleWeek?.id || null,
		visibleWeekLabel: visibleWeek?.label || '',
		visibleWeekRange: visibleWeek ? weekRangeFor(visibleWeek) : null
	};
}

async function getCampHubDataFor(user) {
	const [camp, curriculum, announcements, resources, submissions, printRequests, pointEvents, classroom] = await Promise.all([
		readJsonFile(path.join(campHubDataDir, 'camp.json'), {}),
		readJsonFile(campCurriculumFile, []),
		readJsonFile(campAnnouncementsFile, []),
		readJsonFile(path.join(campHubDataDir, 'resources.json'), []),
		readCampSubmissions(),
		readCampPrintRequests(),
		readCampPointEvents(),
		readCampClassroomState()
	]);
	const isCoach = user.role === 'coach';
	const visibleAnnouncements = (Array.isArray(announcements) ? announcements : [])
		.filter((item) => item.audience === 'all' || item.audience === user.role);
	const visibleResources = (Array.isArray(resources) ? resources : [])
		.filter((item) => !Array.isArray(item.roles) || item.roles.includes(user.role));
	const enrollment = isCoach
		? { source: 'coach', enrolledWeekIds: (Array.isArray(curriculum) ? curriculum : []).map((week) => week.id), visibleWeekId: null, visibleWeekLabel: 'All weeks', visibleWeekRange: null }
		: await getCampEnrollmentForUser(user, curriculum);
	const sourceCurriculum = isCoach
		? (Array.isArray(curriculum) ? curriculum : [])
		: (Array.isArray(curriculum) ? curriculum : []).filter((week) => week.id === enrollment.visibleWeekId);
	const visibleCurriculum = sourceCurriculum.map((week) => ({
		...week,
		days: (Array.isArray(week.days) ? week.days : []).map((day) => {
			if (isCoach) return day;
			const { coachNotes, ...studentDay } = day;
			return studentDay;
		})
	}));
	return {
		user: publicCampUser(user),
		camp,
		curriculum: visibleCurriculum,
		announcements: visibleAnnouncements,
		resources: visibleResources,
		enrollment,
		classroom,
		points: isCoach ? null : campPointsFor(user.id, submissions, printRequests, pointEvents),
		printRequests: isCoach ? [] : printRequests.filter((item) => item.studentId === user.id),
		submissions: isCoach
			? []
			: submissions.filter((item) => item.studentId === user.id && visibleCurriculum.some((week) => (week.days || []).some((day) => day.id === item.dayId)))
	};
}

async function getFllHubDataFor(user) {
	const [season, teams, timeline, announcements, resources, tasks, assignments, sections, members] = await Promise.all([
		readJsonFile(path.join(fllHubDataDir, 'season.json'), {}),
		readJsonFile(path.join(fllHubDataDir, 'teams.json'), []),
		readJsonFile(path.join(fllHubDataDir, 'timeline.json'), []),
		readJsonFile(path.join(fllHubDataDir, 'announcements.json'), []),
		readJsonFile(path.join(fllHubDataDir, 'resources.json'), []),
		readJsonFile(fllTasksFile, []),
		readJsonFile(fllAssignmentsFile, []),
		readJsonFile(fllSeasonSectionsFile, []),
		readJsonFile(fllTeamMembersFile, [])
	]);

	const teamList = Array.isArray(teams) ? teams : [];
	const memberList = Array.isArray(members) ? members : [];
	const visibleTeams = user.role === 'coach' ? teamList : teamList.filter((team) => team.id === user.teamId);
	const visibleTeamIds = new Set(visibleTeams.map((team) => team.id));
	return {
		user: publicFllUser(user),
		season,
		teams: visibleTeams,
		allTeams: user.role === 'coach' ? teamList : undefined,
		teamMembers: memberList.filter((member) => visibleTeamIds.has(member.teamId)),
		timeline: Array.isArray(timeline) ? timeline : [],
		announcements: Array.isArray(announcements) ? announcements : [],
		resources: Array.isArray(resources) ? resources : [],
		curriculum: buildFllCurriculumOverview(tasks, assignments, sections)
	};
}

function buildFllCurriculumOverview(tasks, assignments, sections) {
	const sectionAliases = {
		'Robot Design': 'robot-design',
		'Robot Game': 'robot-game',
		'Innovation Project': 'innovation',
		Innovation: 'innovation',
		'Core Values': 'core-values',
		Judging: 'core-values',
		'Pre-Season': 'innovation'
	};
	const fallbackSections = [
		{ id: 'robot-design', label: 'Robot Design' },
		{ id: 'robot-game', label: 'Robot Game' },
		{ id: 'innovation', label: 'Innovation' },
		{ id: 'core-values', label: 'Core Values' }
	];
	const sourceSections = Array.isArray(sections) && sections.length ? sections : fallbackSections;
	const assignmentLookup = new Map((Array.isArray(assignments) ? assignments : []).map((assignment) => [assignment.id, assignment]));
	const grouped = sourceSections.map((section) => ({
		id: section.id,
		label: section.label,
		summary: section.summary || '',
		focusNow: section.focusNow || '',
		assignments: []
	}));
	const byId = new Map(grouped.map((section) => [section.id, section]));
	const existingTaskIds = new Set((Array.isArray(tasks) ? tasks : []).map((task) => task.id));
	const plannedTasks = getPlannedFllCurriculumTasks().filter((task) => !existingTaskIds.has(task.id));
	for (const task of [...(Array.isArray(tasks) ? tasks : []), ...plannedTasks]) {
		const sectionId = sectionAliases[task.category] || 'innovation';
		const section = byId.get(sectionId);
		if (!section) continue;
		const parentAssignment = assignmentLookup.get(task.assignmentId);
		section.assignments.push({
			id: task.id,
			title: task.title || 'Untitled assignment',
			description: task.description || '',
			category: task.category || '',
			type: task.type || 'assignment',
			workContext: task.workContext || 'any',
			dueDate: task.dueDate || '',
			status: task.status || 'todo',
			parentTitle: parentAssignment?.title || '',
			questionCount: Array.isArray(task.questions) ? task.questions.length : 0
		});
	}
	for (const section of grouped) {
		section.assignments.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
		section.totalAssignments = section.assignments.length;
		section.nextDue = section.assignments.find((assignment) => assignment.status !== 'done') || section.assignments[0] || null;
	}
	return grouped;
}

function getPlannedFllCurriculumTasks() {
	const rows = [
		['2026-11-13', 'Rebuild Review and Attachment Audit', 'Late-season mission selection and run order review', 'Solution Impact Check', 'Core Values Evidence Review'],
		['2026-11-20', 'Reliability Testing Protocol', 'High-value mission consistency trials', 'User Feedback Round 2', 'Team Communication Reset'],
		['2026-12-04', 'Robot Design Explanation Draft', 'Qualifier-style robot game scrimmage', 'Innovation Pitch Draft', 'Judging Role Assignments'],
		['2026-12-11', 'Attachment Simplification Sprint', 'Mission recovery and backup routes', 'Prototype Evidence Board', 'Gracious Professionalism Scenarios'],
		['2026-12-18', 'Engineering Notebook Checkpoint', 'Timed round data review', 'Research Sources Cleanup', 'Winter Break Practice Plan'],
		['2027-01-08', 'Post-break Robot Inspection', 'Mission run refresh and calibration', 'Innovation Project Storyline', 'Team Goal Reset'],
		['2027-01-15', 'Robot Design Judging Practice', 'Robot game accuracy week', 'Expert Feedback Follow-up', 'Core Values Reflection'],
		['2027-01-22', 'Final Attachment Decisions', 'Strategy board update', 'Solution Iteration 3', 'Judging Q&A Practice'],
		['2027-01-29', 'Robot Design Poster Notes', 'Full table run-throughs', 'Innovation Slides Draft', 'Teamwork Strengths Inventory'],
		['2027-02-05', 'Design Tradeoff Explanation', 'Pressure-test first 30 seconds', 'Community Impact Plan', 'Presentation Transitions'],
		['2027-02-12', 'Robot Maintenance Checklist', 'Mission consistency chart review', 'Final Prototype Polish', 'Core Values Examples Bank'],
		['2027-02-19', 'Technical Interview Practice', 'Tournament-style robot game rounds', 'Innovation Script Polish', 'Mock Judging Round 1'],
		['2027-02-26', 'Robot Design Final Review', 'Backup plan and reset practice', 'Innovation Display Final Review', 'Mock Judging Round 2'],
		['2027-03-05', 'Competition Robot Readiness', 'Qualifier readiness scrimmage', 'Project Materials Pack', 'Team Celebration and Roles'],
		['2027-03-12', 'Post-Qualifier Robot Improvements', 'Mission data after event', 'Feedback-based Innovation Update', 'Reflection and Next Goals'],
		['2027-03-19', 'Advanced Design Iteration', 'New target score planning', 'Project Sharing Plan', 'Leadership Rotation'],
		['2027-03-26', 'Season Portfolio Wrap-up', 'Final robot game archive', 'Innovation Project Archive', 'Season Reflection and Showcase']
	];
	const areaInfo = [
		{ category: 'Robot Design', assignmentId: 'assignment-planned-robot-design', context: 'lab' },
		{ category: 'Robot Game', assignmentId: 'assignment-planned-robot-game', context: 'lab' },
		{ category: 'Innovation Project', assignmentId: 'assignment-planned-innovation', context: 'class' },
		{ category: 'Core Values', assignmentId: 'assignment-planned-core-values', context: 'class' }
	];
	return rows.flatMap((row) => {
		const [dueDate, ...titles] = row;
		return titles.map((title, index) => {
			const area = areaInfo[index];
			const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
			return {
				id: `planned-${dueDate}-${slug}`,
				assignmentId: area.assignmentId,
				teamId: 'team-01',
				assignedTo: 'student-team-01-a',
				title,
				description: `Planned curriculum checkpoint for ${area.category}. Coaches can adjust the lesson details as the BIOGLOW season develops.`,
				category: area.category,
				type: 'planned lesson',
				workContext: area.context,
				status: 'todo',
				dueDate,
				questions: []
			};
		});
	});
}

function requireFllCoach(req, res, next) {
	if (!req.fllUser || req.fllUser.role !== 'coach') {
		return res.status(403).json({ success: false, message: 'Coach access required' });
	}
	return next();
}

function slugify(text) {
	return String(text || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
}

function generateStudentPassword() {
	const words = ['glow', 'spark', 'reef', 'firefly', 'coral', 'lumen', 'tide', 'moss', 'fern', 'beam'];
	const word = words[crypto.randomInt(words.length)];
	const num = crypto.randomInt(1000, 9999);
	return `${word}-${num}`;
}

function uniqueUsername(baseName, existingUsernames) {
	const base = slugify(baseName).replace(/-/g, '') || 'student';
	let candidate = base;
	let counter = 1;
	while (existingUsernames.has(candidate)) {
		counter += 1;
		candidate = `${base}${counter}`;
	}
	existingUsernames.add(candidate);
	return candidate;
}

function initialsFromName(name) {
	return String(name || '')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0].toUpperCase())
		.join('') || '?';
}

function requireFllStudent(req, res, next) {
	if (!req.fllUser || req.fllUser.role !== 'student') {
		return res.status(403).json({ success: false, message: 'Student access required' });
	}
	if (!req.fllUser.teamId) {
		return res.status(403).json({ success: false, message: 'No FLL team assigned' });
	}
	return next();
}

function summarizeMilestones(milestones) {
	const safeMilestones = Array.isArray(milestones) ? milestones : [];
	const total = safeMilestones.reduce((sum, group) => sum + (Array.isArray(group.items) ? group.items.length : 0), 0);
	const complete = safeMilestones.reduce((sum, group) => {
		const items = Array.isArray(group.items) ? group.items : [];
		return sum + items.filter((item) => item.complete).length;
	}, 0);
	return {
		total,
		complete,
		percent: total ? Math.round((complete / total) * 100) : 0
	};
}

function getWeekdayInTimeZone(date, timeZone) {
	const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(date);
	return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}

function addDays(date, days) {
	const copy = new Date(date);
	copy.setDate(copy.getDate() + days);
	return copy;
}

function buildNextClassInfo(schedule) {
	if (!schedule || !Number.isInteger(schedule.weekday)) {
		return {
			scheduled: false,
			statusText: 'Next class not scheduled yet',
			daysUntil: null,
			dateLabel: '',
			timeLabel: '',
			room: schedule?.room || ''
		};
	}
	const timeZone = schedule.timezone || 'America/New_York';
	const now = new Date();
	const todayWeekday = getWeekdayInTimeZone(now, timeZone);
	let daysUntil = (schedule.weekday - todayWeekday + 7) % 7;
	const statusText = daysUntil === 0
		? 'Class today'
		: daysUntil === 1
			? 'Class tomorrow'
			: `Class in ${daysUntil} days`;
	const nextDate = addDays(now, daysUntil);
	const dateLabel = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		timeZone
	}).format(nextDate);
	return {
		scheduled: true,
		statusText,
		daysUntil,
		dateLabel,
		timeLabel: `${schedule.startTime || ''}${schedule.endTime ? ` - ${schedule.endTime}` : ''}`.trim(),
		room: schedule.room || '',
		timezone: timeZone,
		weekdayName: schedule.weekdayName || ''
	};
}

function buildBioglowCountdown(releaseDate) {
	const targetDate = releaseDate || '2026-08-04';
	const now = new Date();
	const target = new Date(`${targetDate}T00:00:00-04:00`);
	const diffMs = target.getTime() - now.getTime();
	const daysUntil = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
	return {
		releaseDate: targetDate,
		daysUntil,
		label: daysUntil === 0 ? 'BIOGLOW releases today' : `${daysUntil} days until mission release`
	};
}

function groupStudentTasks(tasks, nextClassInfo) {
	const safeTasks = Array.isArray(tasks) ? tasks : [];
	const openTasks = safeTasks.filter((task) => task.status !== 'done');
	return {
		beforeNextClass: openTasks.filter((task) => {
			if (!nextClassInfo?.scheduled || !task.dueDate) return task.workContext === 'any';
			const due = new Date(`${task.dueDate}T23:59:59-04:00`);
			const now = new Date();
			const nextClass = addDays(now, nextClassInfo.daysUntil || 0);
			nextClass.setHours(23, 59, 59, 999);
			return due <= nextClass;
		}),
		home: safeTasks.filter((task) => task.workContext === 'home'),
		lab: safeTasks.filter((task) => task.workContext === 'lab'),
		class: safeTasks.filter((task) => task.workContext === 'class'),
		any: safeTasks.filter((task) => !['home', 'lab', 'class'].includes(task.workContext || ''))
	};
}

function visibleFllResources(resources, user) {
	return (Array.isArray(resources) ? resources : []).filter((resource) => {
		const roles = Array.isArray(resource.roles) ? resource.roles : [];
		const roleAllowed = !roles.length || roles.includes(user.role);
		const teamAllowed = !resource.teamId || resource.teamId === user.teamId;
		return roleAllowed && teamAllowed;
	});
}

function sectionProgressFromMilestones(sections, milestones) {
	const aliases = {
		'Robot Design': 'robot-design',
		'Robot Game': 'robot-game',
		'Innovation Project': 'innovation',
		'Core Values': 'core-values',
		'Engineering Notebook': 'robot-design',
		'Judging': 'core-values'
	};
	const progress = {};
	for (const section of Array.isArray(sections) ? sections : []) {
		progress[section.id] = { complete: 0, total: 0, percent: 0 };
	}
	for (const group of Array.isArray(milestones) ? milestones : []) {
		const sectionId = aliases[group.category] || null;
		if (!sectionId || !progress[sectionId]) continue;
		const items = Array.isArray(group.items) ? group.items : [];
		progress[sectionId].total += items.length;
		progress[sectionId].complete += items.filter((item) => item.complete).length;
	}
	for (const item of Object.values(progress)) {
		item.percent = item.total ? Math.round((item.complete / item.total) * 100) : 0;
	}
	return progress;
}

async function getFllStudentDashboardFor(user) {
	const [season, teams, timeline, assignments, tasks, milestones, workLogs, members, schedules, resources, sections, missionAnalysis] = await Promise.all([
		readJsonFile(path.join(fllHubDataDir, 'season.json'), {}),
		readJsonFile(path.join(fllHubDataDir, 'teams.json'), []),
		readJsonFile(path.join(fllHubDataDir, 'timeline.json'), []),
		readJsonFile(fllAssignmentsFile, []),
		readJsonFile(fllTasksFile, []),
		readJsonFile(fllMilestonesFile, []),
		readJsonFile(fllWorkLogsFile, []),
		readJsonFile(fllTeamMembersFile, []),
		readJsonFile(fllTeamSchedulesFile, []),
		readJsonFile(path.join(fllHubDataDir, 'resources.json'), []),
		readJsonFile(fllSeasonSectionsFile, []),
		readJsonFile(fllMissionAnalysisFile, [])
	]);
	const team = (Array.isArray(teams) ? teams : []).find((candidate) => candidate.id === user.teamId) || null;
	const teamSchedule = (Array.isArray(schedules) ? schedules : []).find((schedule) => schedule.teamId === user.teamId) || null;
	const nextClass = buildNextClassInfo(teamSchedule);
	const teamAssignments = (Array.isArray(assignments) ? assignments : [])
		.filter((assignment) => assignment.teamId === user.teamId)
		.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
	const myTasks = (Array.isArray(tasks) ? tasks : [])
		.filter((task) => task.teamId === user.teamId && task.assignedTo === user.id)
		.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
	const teamMilestones = (Array.isArray(milestones) ? milestones : []).filter((group) => group.teamId === user.teamId);
	const myWorkLogs = (Array.isArray(workLogs) ? workLogs : [])
		.filter((log) => log.teamId === user.teamId && log.studentId === user.id)
		.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
	const currentPhase = (Array.isArray(timeline) ? timeline : []).find((phase) => phase.status === 'current') || (Array.isArray(timeline) ? timeline[0] : null);
	const teamMembers = (Array.isArray(members) ? members : []).filter((member) => member.teamId === user.teamId);
	const visibleResources = visibleFllResources(resources, user);
	const teamMissionAnalysis = (Array.isArray(missionAnalysis) ? missionAnalysis : []).filter((mission) => mission.teamId === user.teamId);
	const safeSections = Array.isArray(sections) ? sections : [];
	return {
		user: publicFllUser(user),
		season,
		team,
		teamMembers,
		teamSchedule,
		nextClass,
		bioglowCountdown: buildBioglowCountdown(season.releaseDate),
		currentPhase,
		assignments: teamAssignments,
		tasks: myTasks,
		taskGroups: groupStudentTasks(myTasks, nextClass),
		sections: safeSections,
		sectionProgress: sectionProgressFromMilestones(safeSections, teamMilestones),
		missionAnalysis: teamMissionAnalysis,
		milestones: teamMilestones,
		milestoneSummary: summarizeMilestones(teamMilestones),
		workLogs: myWorkLogs,
		resources: visibleResources
	};
}

async function requireFllAuth(req, res, next) {
	try {
		const session = getFllSession(req);
		if (!session) {
			if (req.path.startsWith('/api/')) {
				return res.status(401).json({ success: false, message: 'FLL login required' });
			}
			return res.redirect(302, '/fll-hub/login');
		}
		const users = await readFllUsers();
		const user = users.find((candidate) => candidate.id === session.userId);
		if (!user) {
			fllSessions.delete(session.token);
			clearFllSessionCookie(res);
			return res.redirect(302, '/fll-hub/login');
		}
		req.fllUser = user;
		return next();
	} catch (err) {
		console.error('FLL auth error:', err);
		return res.status(500).json({ success: false, message: 'Server error checking FLL session' });
	}
}

function normalizeEmailForMeta(email) {
	return email.trim().toLowerCase();
}

function normalizePhoneForMeta(phone) {
	return phone.replace(/[^\d]/g, '');
}

function normalizeRegistrationEmail(email) {
	return cleanMetaString(email, 200).toLowerCase();
}

function normalizeRegistrationPhone(phone) {
	return cleanMetaString(phone, 60).replace(/[^\d]/g, '');
}

function buildSummerRegistrationLookup(paymentRecords) {
	const lookup = {
		byEmail: new Map(),
		byPhone: new Map(),
		totalRegistrations: 0,
		totalRevenueCents: 0
	};

	const summerPayments = Array.isArray(paymentRecords)
		? paymentRecords.filter((record) => record && record.productType === 'camp')
		: [];

	for (const record of summerPayments) {
		lookup.totalRegistrations += 1;
		lookup.totalRevenueCents += Number.isFinite(record.amountPaid) ? record.amountPaid : 0;

		const emailKey = normalizeRegistrationEmail(record.email || '');
		const phoneKey = normalizeRegistrationPhone(record.phone || '');

		if (emailKey && !lookup.byEmail.has(emailKey)) {
			lookup.byEmail.set(emailKey, record);
		}
		if (phoneKey && !lookup.byPhone.has(phoneKey)) {
			lookup.byPhone.set(phoneKey, record);
		}
	}

	return lookup;
}

function enrichSummerInquiriesWithRegistrations(inquiries, paymentRecords) {
	const lookup = buildSummerRegistrationLookup(paymentRecords);
	const sourceInquiries = Array.isArray(inquiries) ? inquiries : [];
	const enriched = sourceInquiries.map((lead) => {
		const emailKey = normalizeRegistrationEmail(lead.email || '');
		const phoneKey = normalizeRegistrationPhone(lead.phone || '');
		const registration = (emailKey && lookup.byEmail.get(emailKey)) || (phoneKey && lookup.byPhone.get(phoneKey)) || null;

		if (!registration) {
			return { ...lead, registrationStatus: 'Lead only' };
		}

		return {
			...lead,
			registrationStatus: 'Registered',
			registeredAt: registration.timestamp || '',
			registrationAmountPaid: registration.amountPaid || 0,
			registrationWeeks: Array.isArray(registration.weeks) ? registration.weeks : [],
			stripeSessionId: registration.stripeSessionId || ''
		};
	});

	const convertedLeads = enriched.filter((lead) => lead.registrationStatus === 'Registered').length;
	return {
		records: enriched,
		stats: {
			totalRegistrations: lookup.totalRegistrations,
			convertedLeads,
			totalRevenueCents: lookup.totalRevenueCents,
			leadConversionRate: sourceInquiries.length ? Number(((convertedLeads / sourceInquiries.length) * 100).toFixed(1)) : 0
		}
	};
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

function cleanVisitorSessionId(value) {
	return cleanMetaString(value, 120).replace(/[^a-zA-Z0-9_.:-]/g, '');
}

function buildSummerTrafficStats(data) {
	const now = Date.now();
	const cutoff = now - activeVisitorWindowMs;
	const sessions = Object.values(data.sessions || {});
	const activeSessions = sessions.filter((session) => {
		const lastSeen = new Date(session.lastSeen).getTime();
		return Number.isFinite(lastSeen) && lastSeen >= cutoff;
	});
	const recentVisitors = sessions
		.slice()
		.sort((a, b) => (new Date(b.lastSeen).getTime() || 0) - (new Date(a.lastSeen).getTime() || 0))
		.slice(0, 8)
		.map((session) => {
			const lastSeen = new Date(session.lastSeen).getTime();
			return {
				firstSeen: session.firstSeen || '',
				lastSeen: session.lastSeen || '',
				pageViews: Number.isFinite(session.pageViews) ? session.pageViews : 0,
				referrer: session.referrer || '',
				isActive: Number.isFinite(lastSeen) && lastSeen >= cutoff
			};
		});

	return {
		activeVisitors: activeSessions.length,
		totalVisitors: Number.isFinite(data.totalVisits) ? data.totalVisits : sessions.length,
		totalPageViews: Number.isFinite(data.totalPageViews) ? data.totalPageViews : 0,
		activeWindowSeconds: Math.round(activeVisitorWindowMs / 1000),
		recentVisitors
	};
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
	if (isCoachAdminRequest(req)) {
		return next();
	}

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
	if (isCoachAdminRequest(req)) {
		return next();
	}

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

app.post('/api/summer-traffic/heartbeat', async (req, res) => {
	const {
		sessionId = '',
		eventType = 'heartbeat',
		pageUrl = '',
		referrer = ''
	} = req.body || {};

	const normalizedSessionId = cleanVisitorSessionId(sessionId);
	if (!normalizedSessionId) {
		return res.status(400).json({ success: false, message: 'Missing visitor session' });
	}

	const nowIso = new Date().toISOString();
	const isPageView = eventType === 'pageview';

	try {
		const data = await readSummerTraffic();
		const existingSession = data.sessions[normalizedSessionId];
		const session = existingSession || {
			id: normalizedSessionId,
			firstSeen: nowIso,
			lastSeen: nowIso,
			pageViews: 0,
			referrer: cleanMetaString(referrer, 500),
			firstUrl: cleanMetaString(pageUrl, 1000)
		};

		if (!existingSession) {
			data.totalVisits += 1;
		}

		session.lastSeen = nowIso;
		session.lastUrl = cleanMetaString(pageUrl, 1000);
		if (isPageView) {
			session.pageViews = (Number.isFinite(session.pageViews) ? session.pageViews : 0) + 1;
			data.totalPageViews += 1;
		}
		data.sessions[normalizedSessionId] = session;

		await writeSummerTraffic(data);
		return res.status(200).json({ success: true, stats: buildSummerTrafficStats(data) });
	} catch (err) {
		console.error('Summer traffic heartbeat error:', err);
		return res.status(500).json({ success: false, message: 'Server error tracking visit' });
	}
});

app.get('/api/summer-traffic/stats', requireSummerAdmin, async (req, res) => {
	try {
		const data = await readSummerTraffic();
		return res.json({ success: true, stats: buildSummerTrafficStats(data) });
	} catch (err) {
		console.error('Summer traffic stats error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading traffic stats' });
	}
});

app.get('/api/summer-inquiry/list', requireSummerAdmin, async (req, res) => {
	try {
		const inquiries = await readSummerInquiries();
		const paymentRecords = await payments.readPayments().catch((err) => {
			console.warn('Summer registration lookup unavailable:', err.message);
			return [];
		});
		const conversion = enrichSummerInquiriesWithRegistrations(inquiries, paymentRecords);
		return res.json({
			success: true,
			count: conversion.records.length,
			data: conversion.records,
			conversionStats: conversion.stats
		});
	} catch (err) {
		console.error('Summer inquiry list error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading inquiries' });
	}
});

app.get('/api/summer-inquiry/export', requireSummerAdmin, async (req, res) => {
	const format = (req.query.format || 'csv').toString().toLowerCase();

	try {
		const inquiries = await readSummerInquiries();
		const paymentRecords = await payments.readPayments().catch((err) => {
			console.warn('Summer registration export lookup unavailable:', err.message);
			return [];
		});
		const conversion = enrichSummerInquiriesWithRegistrations(inquiries, paymentRecords);
		const exportRecords = conversion.records;

		if (format === 'json') {
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			res.setHeader('Content-Disposition', 'attachment; filename="summer-inquiries.json"');
			return res.status(200).send(JSON.stringify(exportRecords, null, 2));
		}

		const headers = [
			'id', 'submittedAt', 'parentName', 'childName', 'childGrade', 'email', 'phone', 'childAge',
			'programInterest', 'preferredWeek', 'promoCode', 'freeTrialInterest', 'registrationStatus',
			'registeredAt', 'registrationAmountPaid_usd', 'registrationWeeks', 'stripeSessionId', 'notes'
		];
		const rows = exportRecords.map((record) => headers.map((key) => {
			if (key === 'registrationAmountPaid_usd') {
				return toCsvValue(((record.registrationAmountPaid || 0) / 100).toFixed(2));
			}
			if (key === 'registrationWeeks') {
				return toCsvValue((record.registrationWeeks || []).map((week) => week.label || week.id || '').join(' | '));
			}
			return toCsvValue(record[key] ?? '');
		}).join(','));
		const csvContent = [headers.join(','), ...rows].join('\n');

		res.setHeader('Content-Type', 'text/csv; charset=utf-8');
		res.setHeader('Content-Disposition', 'attachment; filename="summer-inquiries.csv"');
		return res.status(200).send(csvContent);
	} catch (err) {
		console.error('Summer inquiry export error:', err);
		return res.status(500).json({ success: false, message: 'Server error exporting inquiries' });
	}
});

app.get(['/fll-hub/login', '/fll-hub/login/'], (req, res) => {
	res.sendFile(path.join(fllHubDir, 'login.html'));
});

app.get(['/fll-hub', '/fll-hub/'], requireFllAuth, (req, res) => {
	if (req.fllUser.role === 'student') {
		return res.redirect(302, '/fll-hub/student');
	}
	res.sendFile(path.join(fllHubDir, 'hub.html'));
});

app.get(['/fll-hub/curriculum', '/fll-hub/curriculum/'], requireFllAuth, (req, res) => {
	if (req.fllUser.role !== 'coach') {
		return res.redirect(302, '/fll-hub/student');
	}
	res.sendFile(path.join(fllHubDir, 'hub.html'));
});

app.get(['/fll-hub/student', '/fll-hub/student/'], requireFllAuth, (req, res) => {
	if (req.fllUser.role !== 'student') {
		return res.redirect(302, '/fll-hub');
	}
	res.sendFile(path.join(fllHubDir, 'student-dashboard.html'));
});

app.post('/api/fll/login', async (req, res) => {
	try {
		const username = cleanMetaString(req.body.username || '', 80).toLowerCase();
		const password = typeof req.body.password === 'string' ? req.body.password : '';
		const users = await readFllUsers();
		const user = users.find((candidate) => candidate.username.toLowerCase() === username && candidate.active !== false);

		if (!user || !verifyScryptPassword(password, user.password_hash)) {
			return res.status(401).json({ success: false, message: 'Invalid FLL username or password' });
		}

		const token = crypto.randomBytes(32).toString('hex');
		fllSessions.set(token, {
			userId: user.id,
			createdAt: Date.now(),
			lastSeen: Date.now()
		});
		setFllSessionCookie(res, token);
		return res.json({
			success: true,
			user: publicFllUser(user),
			redirectTo: user.role === 'student' ? '/fll-hub/student' : '/fll-hub'
		});
	} catch (err) {
		console.error('FLL login error:', err);
		return res.status(500).json({ success: false, message: 'Server error signing in' });
	}
});

app.post('/api/fll/logout', (req, res) => {
	const session = getFllSession(req);
	if (session) {
		fllSessions.delete(session.token);
	}
	clearFllSessionCookie(res);
	return res.json({ success: true });
});

app.get('/api/fll/session', async (req, res) => {
	try {
		const session = getFllSession(req);
		if (!session) {
			return res.status(401).json({ success: false, message: 'FLL login required' });
		}
		const users = await readFllUsers();
		const user = users.find((candidate) => candidate.id === session.userId && candidate.active !== false);
		if (!user) {
			fllSessions.delete(session.token);
			clearFllSessionCookie(res);
			return res.status(401).json({ success: false, message: 'FLL login required' });
		}
		return res.json({ success: true, user: publicFllUser(user) });
	} catch (err) {
		console.error('FLL session error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading FLL session' });
	}
});

app.get('/api/fll/hub-data', requireFllAuth, async (req, res) => {
	try {
		if (req.fllUser.role !== 'coach') {
			return res.status(403).json({ success: false, message: 'Coach hub access required' });
		}
		const data = await getFllHubDataFor(req.fllUser);
		return res.json({ success: true, data });
	} catch (err) {
		console.error('FLL hub data error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading FLL hub data' });
	}
});

app.get('/api/fll/student-dashboard', requireFllAuth, requireFllStudent, async (req, res) => {
	try {
		const data = await getFllStudentDashboardFor(req.fllUser);
		return res.json({ success: true, data });
	} catch (err) {
		console.error('FLL student dashboard error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading student dashboard' });
	}
});

// ── Coach backend: roster + team + student management ─────────────────────

app.get(['/fll-hub/coach', '/fll-hub/coach/'], requireFllAuth, (req, res) => {
	if (req.fllUser.role !== 'coach') {
		return res.redirect(302, '/fll-hub/student');
	}
	res.sendFile(path.join(fllHubDir, 'coach-dashboard.html'));
});

app.get('/api/fll/coach/roster', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const [teams, members, users, tasks, season] = await Promise.all([
			readJsonFile(path.join(fllHubDataDir, 'teams.json'), []),
			readJsonFile(fllTeamMembersFile, []),
			readFllUsers(),
			readJsonFile(fllTasksFile, []),
			readJsonFile(path.join(fllHubDataDir, 'season.json'), {})
		]);
		const students = users
			.filter((user) => user.role === 'student')
			.map((user) => ({
				id: user.id,
				name: user.name,
				username: user.username,
				teamId: user.teamId || null,
				active: user.active !== false
			}));
		return res.json({
			success: true,
			data: {
				user: publicFllUser(req.fllUser),
				teams: Array.isArray(teams) ? teams : [],
				members: Array.isArray(members) ? members : [],
				students,
				tasks: Array.isArray(tasks) ? tasks : [],
				season
			}
		});
	} catch (err) {
		console.error('FLL coach roster error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading roster' });
	}
});

app.post('/api/fll/coach/teams', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const name = cleanMetaString(req.body.name || '', 80);
		if (!name) {
			return res.status(400).json({ success: false, message: 'Team name is required' });
		}
		const teamsFile = path.join(fllHubDataDir, 'teams.json');
		const teams = await readJsonFile(teamsFile, []);
		const id = `team-${slugify(name)}`;
		if (teams.some((team) => team.id === id)) {
			return res.status(409).json({ success: false, message: 'A team with that name already exists' });
		}
		const team = {
			id,
			name,
			nickname: cleanMetaString(req.body.nickname || '', 80) || name,
			meetingDays: cleanMetaString(req.body.meetingDays || '', 80) || 'To be scheduled',
			coach: cleanMetaString(req.body.coach || '', 80) || req.fllUser.name,
			room: cleanMetaString(req.body.room || '', 80) || 'Robotics Lab',
			currentFocus: cleanMetaString(req.body.currentFocus || '', 300) || 'Pre-season preparation.',
			nextDeliverable: '',
			status: 'Getting ready',
			readiness: 0,
			returning: Boolean(req.body.returning),
			pastSeasons: [],
			studentHighlights: [],
			coachNotes: [],
			createdAt: new Date().toISOString()
		};
		teams.push(team);
		await writeJsonFile(teamsFile, teams);
		return res.status(201).json({ success: true, team });
	} catch (err) {
		console.error('FLL coach create team error:', err);
		return res.status(500).json({ success: false, message: 'Server error creating team' });
	}
});

app.patch('/api/fll/coach/teams/:id', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const teamsFile = path.join(fllHubDataDir, 'teams.json');
		const teams = await readJsonFile(teamsFile, []);
		const team = teams.find((candidate) => candidate.id === req.params.id);
		if (!team) {
			return res.status(404).json({ success: false, message: 'Team not found' });
		}
		const stringFields = ['name', 'nickname', 'meetingDays', 'coach', 'room', 'currentFocus', 'nextDeliverable', 'status', 'region'];
		// keep regionName/firstCompetition in sync when region changes
		if (typeof req.body.region === 'string') {
			const season = await readJsonFile(path.join(fllHubDataDir, 'season.json'), {});
			const region = (season.regions || []).find((candidate) => candidate.id === req.body.region);
			if (region) {
				team.regionName = region.name;
				team.firstCompetition = region.predictedQualifier;
			}
		}
		stringFields.forEach((field) => {
			if (typeof req.body[field] === 'string') {
				team[field] = cleanMetaString(req.body[field], field === 'currentFocus' || field === 'nextDeliverable' ? 300 : 80);
			}
		});
		if (req.body.readiness !== undefined) {
			team.readiness = Math.max(0, Math.min(100, Number(req.body.readiness) || 0));
		}
		if (req.body.returning !== undefined) {
			team.returning = Boolean(req.body.returning);
		}
		await writeJsonFile(teamsFile, teams);
		return res.json({ success: true, team });
	} catch (err) {
		console.error('FLL coach update team error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating team' });
	}
});

app.post('/api/fll/coach/teams/:id/rubrics', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const teamsFile = path.join(fllHubDataDir, 'teams.json');
		const teams = await readJsonFile(teamsFile, []);
		const team = teams.find((candidate) => candidate.id === req.params.id);
		if (!team) {
			return res.status(404).json({ success: false, message: 'Team not found' });
		}
		const season = cleanMetaString(req.body.season || '', 40);
		const label = cleanMetaString(req.body.label || '', 120);
		if (!season || !label) {
			return res.status(400).json({ success: false, message: 'Season and label are required' });
		}
		if (!Array.isArray(team.pastSeasons)) team.pastSeasons = [];
		const entry = {
			id: `rubric-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
			season,
			label,
			url: cleanMetaString(req.body.url || '', 500),
			notes: cleanMetaString(req.body.notes || '', 1000),
			addedAt: new Date().toISOString()
		};
		team.pastSeasons.push(entry);
		await writeJsonFile(teamsFile, teams);
		return res.status(201).json({ success: true, entry, team });
	} catch (err) {
		console.error('FLL coach rubric error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving rubric' });
	}
});

app.delete('/api/fll/coach/teams/:id/rubrics/:rubricId', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const teamsFile = path.join(fllHubDataDir, 'teams.json');
		const teams = await readJsonFile(teamsFile, []);
		const team = teams.find((candidate) => candidate.id === req.params.id);
		if (!team || !Array.isArray(team.pastSeasons)) {
			return res.status(404).json({ success: false, message: 'Team or rubric not found' });
		}
		team.pastSeasons = team.pastSeasons.filter((entry) => entry.id !== req.params.rubricId);
		await writeJsonFile(teamsFile, teams);
		return res.json({ success: true, team });
	} catch (err) {
		console.error('FLL coach rubric delete error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting rubric' });
	}
});

async function createFllStudent({ name, username, password, teamId, role }, users, members, existingUsernames) {
	const finalUsername = username || uniqueUsername(name, existingUsernames);
	const finalPassword = password || generateStudentPassword();
	const id = `student-${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`;
	users.push({
		id,
		name,
		username: finalUsername,
		password_hash: hashScryptPassword(finalPassword),
		role: 'student',
		teamId: teamId || null,
		active: true
	});
	if (teamId) {
		members.push({
			teamId,
			studentId: id,
			displayName: name,
			role: cleanMetaString(role || '', 80) || 'Team member',
			initials: initialsFromName(name)
		});
	}
	return { id, name, username: finalUsername, password: finalPassword, teamId: teamId || null };
}

app.post('/api/fll/coach/students', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const name = cleanMetaString(req.body.name || '', 80);
		if (!name) {
			return res.status(400).json({ success: false, message: 'Student name is required' });
		}
		const username = cleanMetaString(req.body.username || '', 80).toLowerCase() || null;
		const password = typeof req.body.password === 'string' && req.body.password.length >= 6 ? req.body.password : null;
		const teamId = cleanMetaString(req.body.teamId || '', 80) || null;

		const [users, members, teams] = await Promise.all([
			readFllUsers(),
			readJsonFile(fllTeamMembersFile, []),
			readJsonFile(path.join(fllHubDataDir, 'teams.json'), [])
		]);
		if (teamId && !teams.some((team) => team.id === teamId)) {
			return res.status(400).json({ success: false, message: 'Unknown team' });
		}
		const existingUsernames = new Set(users.map((user) => user.username.toLowerCase()));
		if (username && existingUsernames.has(username)) {
			return res.status(409).json({ success: false, message: 'That username is already taken' });
		}
		const credentials = await createFllStudent(
			{ name, username, password, teamId, role: req.body.role },
			users, members, existingUsernames
		);
		await Promise.all([
			writeJsonFile(fllUsersFile, users),
			writeJsonFile(fllTeamMembersFile, members)
		]);
		return res.status(201).json({ success: true, student: credentials });
	} catch (err) {
		console.error('FLL coach add student error:', err);
		return res.status(500).json({ success: false, message: 'Server error adding student' });
	}
});

app.post('/api/fll/coach/students/bulk', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const teamId = cleanMetaString(req.body.teamId || '', 80) || null;
		const rawNames = Array.isArray(req.body.names)
			? req.body.names
			: String(req.body.names || '').split('\n');
		const names = rawNames
			.map((line) => cleanMetaString(String(line), 80))
			.filter(Boolean);
		if (!names.length) {
			return res.status(400).json({ success: false, message: 'Add at least one student name (one per line)' });
		}
		if (names.length > 60) {
			return res.status(400).json({ success: false, message: 'Bulk add is limited to 60 students at a time' });
		}
		const [users, members, teams] = await Promise.all([
			readFllUsers(),
			readJsonFile(fllTeamMembersFile, []),
			readJsonFile(path.join(fllHubDataDir, 'teams.json'), [])
		]);
		if (teamId && !teams.some((team) => team.id === teamId)) {
			return res.status(400).json({ success: false, message: 'Unknown team' });
		}
		const existingUsernames = new Set(users.map((user) => user.username.toLowerCase()));
		const created = [];
		for (const name of names) {
			created.push(await createFllStudent({ name, teamId }, users, members, existingUsernames));
		}
		await Promise.all([
			writeJsonFile(fllUsersFile, users),
			writeJsonFile(fllTeamMembersFile, members)
		]);
		return res.status(201).json({ success: true, students: created });
	} catch (err) {
		console.error('FLL coach bulk add error:', err);
		return res.status(500).json({ success: false, message: 'Server error bulk adding students' });
	}
});

app.patch('/api/fll/coach/students/:id', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const [users, members] = await Promise.all([
			readFllUsers(),
			readJsonFile(fllTeamMembersFile, [])
		]);
		const user = users.find((candidate) => candidate.id === req.params.id && candidate.role === 'student');
		if (!user) {
			return res.status(404).json({ success: false, message: 'Student not found' });
		}
		let newPassword = null;
		if (typeof req.body.name === 'string' && req.body.name.trim()) {
			user.name = cleanMetaString(req.body.name, 80);
		}
		if (req.body.teamId !== undefined) {
			const teamId = cleanMetaString(req.body.teamId || '', 80) || null;
			user.teamId = teamId;
			// keep membership in sync
			const existing = members.find((member) => member.studentId === user.id);
			if (teamId) {
				if (existing) {
					existing.teamId = teamId;
					existing.displayName = user.name;
				} else {
					members.push({
						teamId,
						studentId: user.id,
						displayName: user.name,
						role: 'Team member',
						initials: initialsFromName(user.name)
					});
				}
			} else if (existing) {
				members.splice(members.indexOf(existing), 1);
			}
		}
		if (req.body.active !== undefined) {
			user.active = Boolean(req.body.active);
		}
		if (req.body.resetPassword) {
			newPassword = generateStudentPassword();
			user.password_hash = hashScryptPassword(newPassword);
		}
		// keep member displayName in sync with renames
		members.forEach((member) => {
			if (member.studentId === user.id) {
				member.displayName = user.name;
				member.initials = initialsFromName(user.name);
			}
		});
		await Promise.all([
			writeJsonFile(fllUsersFile, users),
			writeJsonFile(fllTeamMembersFile, members)
		]);
		return res.json({
			success: true,
			student: { id: user.id, name: user.name, username: user.username, teamId: user.teamId, active: user.active !== false },
			newPassword
		});
	} catch (err) {
		console.error('FLL coach update student error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating student' });
	}
});

// ── Coach: resource management ─────────────────────────────────────────────

app.post('/api/fll/coach/resources', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const label = cleanMetaString(req.body.label || '', 120);
		const url = cleanMetaString(req.body.url || '', 600);
		if (!label || !url) {
			return res.status(400).json({ success: false, message: 'Resource name and link are required' });
		}
		const resourcesFile = path.join(fllHubDataDir, 'resources.json');
		const resources = await readJsonFile(resourcesFile, []);
		const resource = {
			id: `resource-${slugify(label)}-${crypto.randomBytes(3).toString('hex')}`,
			category: cleanMetaString(req.body.category || '', 60) || 'Other',
			label,
			description: cleanMetaString(req.body.description || '', 300),
			type: cleanMetaString(req.body.type || '', 30) || 'Website',
			source: 'Coach-added',
			url,
			roles: req.body.coachOnly ? ['coach'] : ['student', 'coach']
		};
		resources.push(resource);
		await writeJsonFile(resourcesFile, resources);
		return res.status(201).json({ success: true, resource });
	} catch (err) {
		console.error('FLL coach add resource error:', err);
		return res.status(500).json({ success: false, message: 'Server error adding resource' });
	}
});

app.delete('/api/fll/coach/resources/:id', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const resourcesFile = path.join(fllHubDataDir, 'resources.json');
		const resources = await readJsonFile(resourcesFile, []);
		const remaining = resources.filter((resource) => resource.id !== req.params.id);
		if (remaining.length === resources.length) {
			return res.status(404).json({ success: false, message: 'Resource not found' });
		}
		await writeJsonFile(resourcesFile, remaining);
		return res.json({ success: true });
	} catch (err) {
		console.error('FLL coach delete resource error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting resource' });
	}
});

// ── Coach: assignment management (creates one task per student) ───────────

app.post('/api/fll/coach/assignments', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const title = cleanMetaString(req.body.title || '', 160);
		const category = cleanMetaString(req.body.category || '', 60);
		const dueDate = cleanMetaString(req.body.dueDate || '', 10);
		if (!title || !category || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
			return res.status(400).json({ success: false, message: 'Title, FLL area, and a valid due date are required' });
		}
		const teamId = cleanMetaString(req.body.teamId || '', 80) || 'all';
		const [tasks, members] = await Promise.all([
			readJsonFile(fllTasksFile, []),
			readJsonFile(fllTeamMembersFile, [])
		]);
		const targets = (Array.isArray(members) ? members : [])
			.filter((member) => teamId === 'all' || member.teamId === teamId);
		if (!targets.length) {
			return res.status(400).json({ success: false, message: 'No students found for that team' });
		}
		const baseId = `task-${slugify(title)}-${crypto.randomBytes(3).toString('hex')}`;
		const now = new Date().toISOString();
		const created = targets.map((member, index) => ({
			id: `${baseId}-${index}`,
			assignmentId: 'assignment-coach-created',
			teamId: member.teamId,
			assignedTo: member.studentId,
			title,
			description: cleanMetaString(req.body.description || '', 4000),
			category,
			type: cleanMetaString(req.body.type || '', 30) || 'submission',
			workContext: cleanMetaString(req.body.workContext || '', 20) || 'class',
			status: 'todo',
			dueDate,
			questions: Array.isArray(req.body.questions) ? req.body.questions : [],
			createdBy: req.fllUser.id,
			createdAt: now,
			updatedAt: now
		}));
		tasks.push(...created);
		await writeJsonFile(fllTasksFile, tasks);
		return res.status(201).json({ success: true, count: created.length, title });
	} catch (err) {
		console.error('FLL coach add assignment error:', err);
		return res.status(500).json({ success: false, message: 'Server error adding assignment' });
	}
});

// update every task that shares a title (assignments are duplicated per student)
app.patch('/api/fll/coach/assignments', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const matchTitle = cleanMetaString(req.body.matchTitle || '', 160);
		if (!matchTitle) {
			return res.status(400).json({ success: false, message: 'matchTitle is required' });
		}
		const tasks = await readJsonFile(fllTasksFile, []);
		const group = tasks.filter((task) => task.title === matchTitle);
		if (!group.length) {
			return res.status(404).json({ success: false, message: 'Assignment not found' });
		}
		const now = new Date().toISOString();
		group.forEach((task) => {
			if (typeof req.body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.dueDate)) {
				task.dueDate = req.body.dueDate;
			}
			if (typeof req.body.title === 'string' && req.body.title.trim()) {
				task.title = cleanMetaString(req.body.title, 160);
			}
			task.updatedAt = now;
		});
		await writeJsonFile(fllTasksFile, tasks);
		return res.json({ success: true, count: group.length });
	} catch (err) {
		console.error('FLL coach update assignment error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating assignment' });
	}
});

app.delete('/api/fll/coach/assignments', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const matchTitle = cleanMetaString(req.query.title || '', 160);
		if (!matchTitle) {
			return res.status(400).json({ success: false, message: 'title query param is required' });
		}
		const tasks = await readJsonFile(fllTasksFile, []);
		const remaining = tasks.filter((task) => task.title !== matchTitle);
		if (remaining.length === tasks.length) {
			return res.status(404).json({ success: false, message: 'Assignment not found' });
		}
		await writeJsonFile(fllTasksFile, remaining);
		return res.json({ success: true, removed: tasks.length - remaining.length });
	} catch (err) {
		console.error('FLL coach delete assignment error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting assignment' });
	}
});

app.post('/api/fll/tasks/:id/status', requireFllAuth, requireFllStudent, async (req, res) => {
	try {
		const allowedStatuses = new Set(['todo', 'doing', 'blocked', 'done']);
		const status = cleanMetaString(req.body.status || '', 20).toLowerCase();
		if (!allowedStatuses.has(status)) {
			return res.status(400).json({ success: false, message: 'Invalid task status' });
		}
		const tasks = await readJsonFile(fllTasksFile, []);
		if (!Array.isArray(tasks)) {
			return res.status(500).json({ success: false, message: 'Task data is invalid' });
		}
		const task = tasks.find((candidate) => candidate.id === req.params.id);
		if (!task || task.teamId !== req.fllUser.teamId || task.assignedTo !== req.fllUser.id) {
			return res.status(403).json({ success: false, message: 'You can only update your own assigned tasks' });
		}
		task.status = status;
		task.updatedAt = new Date().toISOString();
		await writeJsonFile(fllTasksFile, tasks);
		return res.json({ success: true, task });
	} catch (err) {
		console.error('FLL task status error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating task' });
	}
});

app.post('/api/fll/tasks/:id/work-log', requireFllAuth, requireFllStudent, async (req, res) => {
	try {
		const tasks = await readJsonFile(fllTasksFile, []);
		if (!Array.isArray(tasks)) {
			return res.status(500).json({ success: false, message: 'Task data is invalid' });
		}
		const task = tasks.find((candidate) => candidate.id === req.params.id);
		if (!task || task.teamId !== req.fllUser.teamId || task.assignedTo !== req.fllUser.id) {
			return res.status(403).json({ success: false, message: 'You can only log work for your own assigned tasks' });
		}
		const location = cleanMetaString(req.body.location || '', 20).toLowerCase();
		if (!['lab', 'home', 'class'].includes(location)) {
			return res.status(400).json({ success: false, message: 'Choose lab, home, or class for the work location' });
		}
		const minutes = Math.max(0, Math.min(600, Number(req.body.minutes) || 0));
		const note = cleanMetaString(req.body.note || '', 1000);
		if (!note) {
			return res.status(400).json({ success: false, message: 'Add a short work note' });
		}
		const workLogs = await readJsonFile(fllWorkLogsFile, []);
		if (!Array.isArray(workLogs)) {
			return res.status(500).json({ success: false, message: 'Work log data is invalid' });
		}
		const now = new Date().toISOString();
		const log = {
			id: `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
			taskId: task.id,
			teamId: req.fllUser.teamId,
			studentId: req.fllUser.id,
			location,
			minutes,
			note,
			blocked: Boolean(req.body.blocked),
			createdAt: now
		};
		workLogs.push(log);
		task.updatedAt = now;
		if (log.blocked && task.status !== 'done') {
			task.status = 'blocked';
		}
		await Promise.all([
			writeJsonFile(fllWorkLogsFile, workLogs),
			writeJsonFile(fllTasksFile, tasks)
		]);
		return res.status(201).json({ success: true, log, task });
	} catch (err) {
		console.error('FLL work log error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving work log' });
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
	// Camp hub API routes are registered later on this app — skip the codeLab proxy.
	if (req.path.startsWith('/camp/')) return next();
	req.url = `/api${req.url}`;
	codeLabApp(req, res, next);
});
app.use('/fll-assets', (req, res, next) => {
	req.url = `/fll-assets${req.url}`;
	codeLabApp(req, res, next);
});

// ── Summer Camp Hub ──
app.get(['/camp-hub/login', '/camp-hub/login/'], (req, res) => {
	res.sendFile(path.join(campHubDir, 'login.html'));
});

app.get(['/camp-hub', '/camp-hub/'], requireCampAuth, (req, res) => {
	res.sendFile(path.join(campHubDir, 'hub.html'));
});

app.get(['/camp-hub/coach', '/camp-hub/coach/'], requireCampAuth, (req, res) => {
	if (req.campUser.role !== 'coach') {
		return res.redirect(302, '/camp-hub');
	}
	res.sendFile(path.join(campHubDir, 'coach.html'));
});

app.post('/api/camp/login', async (req, res) => {
	try {
		const username = cleanMetaString(req.body.username || '', 80).toLowerCase();
		const password = typeof req.body.password === 'string' ? req.body.password : '';
		const users = await readCampUsers();
		const user = users.find((candidate) => candidate.username.toLowerCase() === username && candidate.active !== false);

		if (!user || !verifyScryptPassword(password, user.password_hash)) {
			return res.status(401).json({ success: false, message: 'Invalid camp username or password' });
		}

		const token = crypto.randomBytes(32).toString('hex');
		campSessions.set(token, {
			userId: user.id,
			createdAt: Date.now(),
			lastSeen: Date.now()
		});
		setCampSessionCookie(res, token);
		return res.json({
			success: true,
			user: publicCampUser(user),
			redirectTo: user.role === 'coach' ? '/camp-hub/coach' : '/camp-hub'
		});
	} catch (err) {
		console.error('Camp login error:', err);
		return res.status(500).json({ success: false, message: 'Server error signing in' });
	}
});

app.post('/api/camp/logout', (req, res) => {
	const session = getCampSession(req);
	if (session) {
		campSessions.delete(session.token);
	}
	clearCampSessionCookie(res);
	return res.json({ success: true });
});

app.get('/api/camp/session', async (req, res) => {
	try {
		const session = getCampSession(req);
		if (!session) {
			return res.status(401).json({ success: false, message: 'Camp login required' });
		}
		const users = await readCampUsers();
		const user = users.find((candidate) => candidate.id === session.userId && candidate.active !== false);
		if (!user) {
			campSessions.delete(session.token);
			clearCampSessionCookie(res);
			return res.status(401).json({ success: false, message: 'Camp login required' });
		}
		return res.json({ success: true, user: publicCampUser(user) });
	} catch (err) {
		console.error('Camp session error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading camp session' });
	}
});

app.get('/api/camp/hub-data', requireCampAuth, async (req, res) => {
	try {
		const data = await getCampHubDataFor(req.campUser);
		return res.json({ success: true, data });
	} catch (err) {
		console.error('Camp hub data error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading camp hub data' });
	}
});

app.post('/api/camp/submissions', requireCampAuth, async (req, res) => {
	try {
		if (!req.campUser || req.campUser.role !== 'student') {
			return res.status(403).json({ success: false, message: 'Camper access required' });
		}
		const dayId = cleanMetaString(req.body.dayId || '', 120);
		const reflection = cleanMetaString(req.body.reflection || '', 1800);
		const photoDataUrl = typeof req.body.photoDataUrl === 'string' ? req.body.photoDataUrl : '';
		if (!dayId) {
			return res.status(400).json({ success: false, message: 'Assignment day is required' });
		}
		if (!reflection && !photoDataUrl) {
			return res.status(400).json({ success: false, message: 'Add a reflection or a photo before submitting' });
		}
		if (photoDataUrl && (!photoDataUrl.startsWith('data:image/') || photoDataUrl.length > 8 * 1024 * 1024)) {
			return res.status(400).json({ success: false, message: 'Photo must be an image under 8 MB after compression' });
		}

		const curriculum = await readJsonFile(campCurriculumFile, []);
		const enrollment = await getCampEnrollmentForUser(req.campUser, curriculum);
		const visibleWeek = (Array.isArray(curriculum) ? curriculum : []).find((week) => week.id === enrollment.visibleWeekId);
		const day = (visibleWeek && Array.isArray(visibleWeek.days) ? visibleWeek.days : [])
			.find((candidate) => candidate.id === dayId);
		if (!day) {
			return res.status(404).json({ success: false, message: 'Assignment is not available for your current camp week' });
		}

		const submissions = await readCampSubmissions();
		const now = new Date().toISOString();
		const existing = submissions.find((item) => item.dayId === dayId && item.studentId === req.campUser.id);
		const payload = {
			id: existing?.id || `camp-sub-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
			dayId,
			studentId: req.campUser.id,
			studentName: req.campUser.name,
			className: req.campUser.className || 'Unassigned',
			reflection,
			photoDataUrl,
			updatedAt: now,
			submittedAt: existing?.submittedAt || now
		};
		if (existing) {
			Object.assign(existing, payload);
		} else {
			submissions.push(payload);
		}
		await writeJsonFile(campSubmissionsFile, submissions);
		return res.status(existing ? 200 : 201).json({ success: true, submission: payload });
	} catch (err) {
		console.error('Camp submission error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving submission' });
	}
});

app.post('/api/camp/print-requests', requireCampAuth, async (req, res) => {
	try {
		if (!req.campUser || req.campUser.role !== 'student') {
			return res.status(403).json({ success: false, message: 'Camper access required' });
		}
		const title = cleanMetaString(req.body.title || '', 120);
		const purpose = cleanMetaString(req.body.purpose || '', 800);
		const dimensions = cleanMetaString(req.body.dimensions || '', 160);
		const color = cleanMetaString(req.body.color || '', 80);
		const notes = cleanMetaString(req.body.notes || '', 800);
		if (!title || !purpose) {
			return res.status(400).json({ success: false, message: 'Project name and purpose are required' });
		}
		const requests = await readCampPrintRequests();
		const now = new Date().toISOString();
		const request = {
			id: `print-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
			studentId: req.campUser.id,
			studentName: req.campUser.name,
			className: req.campUser.className || 'Unassigned',
			title,
			purpose,
			dimensions,
			color,
			notes,
			status: 'pending',
			pointsAwarded: 0,
			coachNotes: '',
			createdAt: now,
			updatedAt: now
		};
		requests.push(request);
		await writeJsonFile(campPrintRequestsFile, requests);
		return res.status(201).json({ success: true, request, points: campPointsFor(req.campUser.id, await readCampSubmissions(), requests, await readCampPointEvents()) });
	} catch (err) {
		console.error('Camp print request error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving print request' });
	}
});

app.patch('/api/camp/coach/days/:dayId', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const curriculum = await readJsonFile(campCurriculumFile, []);
		let updatedDay = null;
		for (const week of curriculum) {
			const day = (Array.isArray(week.days) ? week.days : []).find((candidate) => candidate.id === req.params.dayId);
			if (day) {
				if (typeof req.body.activity === 'string') day.activity = cleanMetaString(req.body.activity, 600);
				if (typeof req.body.build === 'string') day.build = cleanMetaString(req.body.build, 120);
				if (typeof req.body.coachNotes === 'string') day.coachNotes = cleanMetaString(req.body.coachNotes, 600);
				if (typeof req.body.assignment === 'string') day.assignment = cleanMetaString(req.body.assignment, 900);
				if (typeof req.body.worksheetLabel === 'string') day.worksheetLabel = cleanMetaString(req.body.worksheetLabel, 120);
				if (typeof req.body.worksheetUrl === 'string') day.worksheetUrl = cleanMetaString(req.body.worksheetUrl, 1000);
				updatedDay = day;
				break;
			}
		}
		if (!updatedDay) {
			return res.status(404).json({ success: false, message: 'Camp day not found' });
		}
		await writeJsonFile(campCurriculumFile, curriculum);
		return res.json({ success: true, day: updatedDay });
	} catch (err) {
		console.error('Camp coach day update error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving the day' });
	}
});

app.patch('/api/camp/coach/classroom', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const current = await readCampClassroomState();
		const next = normalizeCampClassroomState({
			...current,
			...(req.body || {}),
			timer: {
				...current.timer,
				...(req.body?.timer && typeof req.body.timer === 'object' ? req.body.timer : {})
			}
		});
		await writeJsonFile(campClassroomFile, next);
		return res.json({ success: true, classroom: next });
	} catch (err) {
		console.error('Camp classroom update error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating classroom tools' });
	}
});

app.post('/api/camp/coach/classroom/groups', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const state = await readCampClassroomState();
		const group = {
			id: `group-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
			name: cleanMetaString(req.body.name || '', 120) || 'New Group',
			focus: cleanMetaString(req.body.focus || '', 240),
			members: Array.isArray(req.body.members) ? req.body.members.map((member) => cleanMetaString(member, 80)).filter(Boolean) : [],
			subgroups: Array.isArray(req.body.subgroups) ? req.body.subgroups.map((subgroup) => ({
				id: `subgroup-${crypto.randomBytes(3).toString('hex')}`,
				name: cleanMetaString(subgroup.name || '', 120) || 'Subgroup',
				members: Array.isArray(subgroup.members) ? subgroup.members.map((member) => cleanMetaString(member, 80)).filter(Boolean) : []
			})) : []
		};
		state.groups.push(group);
		const next = normalizeCampClassroomState(state);
		await writeJsonFile(campClassroomFile, next);
		return res.status(201).json({ success: true, classroom: next, group });
	} catch (err) {
		console.error('Camp group create error:', err);
		return res.status(500).json({ success: false, message: 'Server error creating group' });
	}
});

app.delete('/api/camp/coach/classroom/groups/:id', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const state = await readCampClassroomState();
		const before = state.groups.length;
		state.groups = state.groups.filter((group) => group.id !== req.params.id);
		if (state.groups.length === before) {
			return res.status(404).json({ success: false, message: 'Group not found' });
		}
		await writeJsonFile(campClassroomFile, state);
		return res.json({ success: true, classroom: state });
	} catch (err) {
		console.error('Camp group delete error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting group' });
	}
});

app.post('/api/camp/coach/announcements', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const title = cleanMetaString(req.body.title || '', 140);
		const body = cleanMetaString(req.body.body || '', 1000);
		const audience = req.body.audience === 'coach' ? 'coach' : 'all';
		if (!title || !body) {
			return res.status(400).json({ success: false, message: 'Title and message are required' });
		}
		const announcements = await readJsonFile(campAnnouncementsFile, []);
		announcements.push({
			id: `ann-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
			date: new Date().toISOString().slice(0, 10),
			audience,
			title,
			body
		});
		await writeJsonFile(campAnnouncementsFile, announcements);
		return res.status(201).json({ success: true, announcements });
	} catch (err) {
		console.error('Camp coach announcement error:', err);
		return res.status(500).json({ success: false, message: 'Server error posting announcement' });
	}
});

app.delete('/api/camp/coach/announcements/:id', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const announcements = await readJsonFile(campAnnouncementsFile, []);
		const remaining = announcements.filter((item) => item.id !== req.params.id);
		if (remaining.length === announcements.length) {
			return res.status(404).json({ success: false, message: 'Announcement not found' });
		}
		await writeJsonFile(campAnnouncementsFile, remaining);
		return res.json({ success: true, announcements: remaining });
	} catch (err) {
		console.error('Camp coach announcement delete error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting announcement' });
	}
});

app.get('/api/camp/coach/roster', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const users = await readCampUsers();
		return res.json({
			success: true,
			users: users.map((user) => ({
				id: user.id,
				name: user.name,
				username: user.username,
				role: user.role,
				active: user.active !== false,
				className: user.className || 'Unassigned'
			}))
		});
	} catch (err) {
		console.error('Camp coach roster error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading roster' });
	}
});

app.get('/api/camp/coach/progress', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const [users, curriculum, submissions, printRequests, pointEvents] = await Promise.all([
			readCampUsers(),
			readJsonFile(campCurriculumFile, []),
			readCampSubmissions(),
			readCampPrintRequests(),
			readCampPointEvents()
		]);
		const students = users
			.filter((user) => user.role === 'student')
			.map((user) => ({
				id: user.id,
				name: user.name,
				username: user.username,
				active: user.active !== false,
				className: user.className || 'Unassigned',
				points: campPointsFor(user.id, submissions, printRequests, pointEvents)
			}));
		const days = (Array.isArray(curriculum) ? curriculum : []).flatMap((week) =>
			(Array.isArray(week.days) ? week.days : []).map((day) => ({
				id: day.id,
				date: day.date,
				week: week.label,
				theme: week.theme,
				activity: day.activity,
				assignment: day.assignment || day.activity || '',
				build: day.build || '',
				worksheetLabel: day.worksheetLabel || '',
				worksheetUrl: day.worksheetUrl || ''
			}))
		);
		return res.json({ success: true, students, days, submissions, printRequests, pointEvents });
	} catch (err) {
		console.error('Camp coach progress error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading progress' });
	}
});

app.get('/api/camp/coach/print-requests', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const requests = await readCampPrintRequests();
		return res.json({ success: true, requests });
	} catch (err) {
		console.error('Camp coach print queue error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading print queue' });
	}
});

app.patch('/api/camp/coach/print-requests/:id', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const requests = await readCampPrintRequests();
		const request = requests.find((item) => item.id === req.params.id);
		if (!request) {
			return res.status(404).json({ success: false, message: 'Print request not found' });
		}
		const statuses = new Set(['pending', 'approved', 'printing', 'ready', 'completed', 'needs-changes', 'declined']);
		const status = cleanMetaString(req.body.status || '', 40);
		if (status && statuses.has(status)) request.status = status;
		if (typeof req.body.coachNotes === 'string') request.coachNotes = cleanMetaString(req.body.coachNotes, 1000);
		if (req.body.pointsAwarded !== undefined) {
			const points = Number(req.body.pointsAwarded);
			request.pointsAwarded = Number.isFinite(points) ? Math.max(0, Math.min(100, Math.round(points))) : 0;
		}
		request.updatedAt = new Date().toISOString();
		await writeJsonFile(campPrintRequestsFile, requests);
		return res.json({ success: true, request, requests });
	} catch (err) {
		console.error('Camp coach print update error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating print request' });
	}
});

app.post('/api/camp/coach/points', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const studentId = cleanMetaString(req.body.studentId || '', 120);
		const category = cleanMetaString(req.body.category || '', 80) || 'Teamwork';
		const note = cleanMetaString(req.body.note || '', 500);
		const type = req.body.type === 'needs-work' ? 'needs-work' : 'positive';
		const rawPoints = Number(req.body.points);
		const magnitude = Number.isFinite(rawPoints) ? Math.max(1, Math.min(20, Math.abs(Math.round(rawPoints)))) : 1;
		const points = type === 'needs-work' ? -magnitude : magnitude;
		const users = await readCampUsers();
		const student = users.find((candidate) => candidate.id === studentId && candidate.role === 'student');
		if (!student) {
			return res.status(404).json({ success: false, message: 'Camper not found' });
		}
		const events = await readCampPointEvents();
		const event = {
			id: `point-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
			studentId: student.id,
			studentName: student.name,
			className: student.className || 'Unassigned',
			category,
			type,
			points,
			note,
			createdBy: req.campUser.id,
			createdByName: req.campUser.name,
			createdAt: new Date().toISOString()
		};
		events.push(event);
		await writeJsonFile(campPointEventsFile, events);
		const [submissions, printRequests] = await Promise.all([readCampSubmissions(), readCampPrintRequests()]);
		return res.status(201).json({
			success: true,
			event,
			points: campPointsFor(student.id, submissions, printRequests, events),
			pointEvents: events
		});
	} catch (err) {
		console.error('Camp coach point event error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving points' });
	}
});

app.post('/api/camp/coach/students', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const name = cleanMetaString(req.body.name || '', 80);
		if (!name) {
			return res.status(400).json({ success: false, message: 'Camper name is required' });
		}
		const className = cleanMetaString(req.body.className || '', 80) || 'Unassigned';
		const username = cleanMetaString(req.body.username || '', 80).toLowerCase() || null;
		const password = typeof req.body.password === 'string' && req.body.password.length >= 6 ? req.body.password : null;
		const users = await readCampUsers();
		const existingUsernames = new Set(users.map((user) => user.username.toLowerCase()));
		if (username && existingUsernames.has(username)) {
			return res.status(409).json({ success: false, message: 'That username is already taken' });
		}
		const finalUsername = username || uniqueUsername(name, existingUsernames);
		const finalPassword = password || generateStudentPassword();
		const id = `camper-${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`;
		users.push({
			id,
			name,
			username: finalUsername,
			password_hash: hashScryptPassword(finalPassword),
			role: 'student',
			className,
			active: true
		});
		await writeJsonFile(campUsersFile, users);
		return res.status(201).json({ success: true, student: { id, name, username: finalUsername, password: finalPassword, className } });
	} catch (err) {
		console.error('Camp coach add camper error:', err);
		return res.status(500).json({ success: false, message: 'Server error adding camper' });
	}
});

app.patch('/api/camp/coach/students/:id', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const users = await readCampUsers();
		const user = users.find((candidate) => candidate.id === req.params.id && candidate.role === 'student');
		if (!user) {
			return res.status(404).json({ success: false, message: 'Camper not found' });
		}
		let newPassword = null;
		if (req.body.resetPassword === true) {
			newPassword = generateStudentPassword();
			user.password_hash = hashScryptPassword(newPassword);
		}
		if (typeof req.body.active === 'boolean') {
			user.active = req.body.active;
		}
		if (typeof req.body.name === 'string' && cleanMetaString(req.body.name, 80)) {
			user.name = cleanMetaString(req.body.name, 80);
		}
		if (typeof req.body.className === 'string') {
			user.className = cleanMetaString(req.body.className, 80) || 'Unassigned';
		}
		await writeJsonFile(campUsersFile, users);
		const response = { success: true, user: { id: user.id, name: user.name, username: user.username, active: user.active !== false, className: user.className || 'Unassigned' } };
		if (newPassword) response.password = newPassword;
		return res.json(response);
	} catch (err) {
		console.error('Camp coach update camper error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating camper' });
	}
});

app.use((req, res, next) => {
	const requestPath = decodeURIComponent(req.path || '');
	const fllStaticRoot = '/robotics lab/FLL Teams/2026-2027-bioglow';
	const campStaticRoot = '/robotics lab/Summer Camp/2026-summer-camp';
	if (requestPath.startsWith(`${campStaticRoot}/data/`)) {
		return res.status(404).send('Not found');
	}
	if (requestPath === `${campStaticRoot}/hub.html`) {
		return requireCampAuth(req, res, () => res.sendFile(path.join(campHubDir, 'hub.html')));
	}
	if (requestPath === `${campStaticRoot}/coach.html`) {
		return requireCampAuth(req, res, () => {
			if (req.campUser.role !== 'coach') {
				return res.redirect(302, '/camp-hub');
			}
			return res.sendFile(path.join(campHubDir, 'coach.html'));
		});
	}
	if (requestPath === `${campStaticRoot}/login.html`) {
		return res.redirect(302, '/camp-hub/login');
	}
	if (requestPath.startsWith(`${fllStaticRoot}/data/`)) {
		return res.status(404).send('Not found');
	}
	if (requestPath === `${fllStaticRoot}/hub.html`) {
		return requireFllAuth(req, res, () => res.sendFile(path.join(fllHubDir, 'hub.html')));
	}
	if (requestPath === `${fllStaticRoot}/student-dashboard.html`) {
		return requireFllAuth(req, res, () => {
			if (req.fllUser.role !== 'student') {
				return res.redirect(302, '/fll-hub');
			}
			return res.sendFile(path.join(fllHubDir, 'student-dashboard.html'));
		});
	}
	if (requestPath === `${fllStaticRoot}/login.html`) {
		return res.redirect(302, '/fll-hub/login');
	}
	return next();
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

initializeFllDataDir()
	.then(() => initializeCampDataDir())
	.then(() => initializeCoachDataDir())
	.then(() => initializeMasterRoster())
	.then(() => {
		app.listen(PORT, () => console.log(`AI Future Platform running at http://localhost:${PORT}`));
	})
	.catch((err) => {
		console.error('Failed to initialize hub data:', err);
		process.exit(1);
	});
