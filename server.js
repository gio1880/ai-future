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
const fllLiveLessonFile = path.join(fllHubDataDir, 'live-lesson.json');
const codeLabStudentsFile = path.join(__dirname, 'code-lab', 'data', 'students.json');
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
	'resources.json',
	'live-lesson.json'
];
const fllSessions = new Map();
const campHubDir = path.join(__dirname, 'robotics lab', 'Summer Camp', '2026-summer-camp');
const campSeedDataDir = path.join(campHubDir, 'data');
const lessonBuildingDir = path.join(__dirname, 'Lesson Building');
const lessonBuildingSource = 'lesson-building-2026-weeks-1-4';
const campHubDataDir = process.env.CAMP_DATA_DIR || path.join(platformDataDir, 'camp-hub', '2026-summer-camp', 'data');
const campUsersFile = path.join(campHubDataDir, 'camp-users.json');
const campCurriculumFile = path.join(campHubDataDir, 'curriculum.json');
const campAnnouncementsFile = path.join(campHubDataDir, 'announcements.json');
const campSubmissionsFile = path.join(campHubDataDir, 'submissions.json');
const campPrintRequestsFile = path.join(campHubDataDir, 'print-requests.json');
const campProjectSubmissionsFile = path.join(campHubDataDir, 'project-submissions.json');
const campPointEventsFile = path.join(campHubDataDir, 'point-events.json');
const campClassroomFile = path.join(campHubDataDir, 'classroom-state.json');
const campLessonsFile = path.join(campHubDataDir, 'lessons.json');
const campLiveLessonFile = path.join(campHubDataDir, 'live-lesson.json');
const campBeginLessonResponsesFile = path.join(campHubDataDir, 'begin-lesson-responses.json');
const campWarmupBroadcastFile = path.join(campHubDataDir, 'warmup-broadcast.json');
const campSessionCookie = 'camp_session';
const campDataFileNames = [
	'camp-users.json',
	'camp.json',
	'curriculum.json',
	'announcements.json',
	'resources.json',
	'submissions.json',
	'print-requests.json',
	'project-submissions.json',
	'point-events.json',
	'classroom-state.json',
	'lessons.json',
	'live-lesson.json',
	'begin-lesson-responses.json',
	'warmup-broadcast.json'
];
const campSessions = new Map();
const coachUsersFile = path.join(platformDataDir, 'coach-users.json');
const coachSessionCookie = 'coach_session';
const coachSessions = new Map();
// Shared one-time code coaches enter to claim their account and set a password.
const coachSetupCode = process.env.COACH_SETUP_CODE || 'aifuture2026';
const masterRosterFile = path.join(platformDataDir, 'master-roster.json');
const summerRosterSource = 'summer-2026-screenshot-grade-roster';
const summerDemoStudentId = 'master-demo-summer-camper';
const summerDemoCampUserId = 'camp-demo-summer-camper';
const studentPortalCookie = 'student_session';
const studentPortalSessions = new Map();
const regularCoachHubs = [
	'master-roster',
	'summer-curriculum',
	'fll-competitive-curriculum',
	'ftc-curriculum',
	'fll-hub',
	'camp-hub',
	'code-lab-admin'
];
const adminCoachHubs = [...regularCoachHubs, 'access-control', 'payments-admin', 'parent-leads-admin', 'summer-leads-admin'];
const coachHubDefinitions = {
	'access-control': {
		id: 'access-control',
		title: 'Access Control',
		category: 'Admin',
		description: 'Master backend for coach logins, passwords, hub permissions, and account status.',
		targetUrl: '/access-control',
		grant: 'access-control',
		adminOnly: true
	},
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

app.get(['/access-control', '/access-control/'], requireCoachOwner, (req, res) => {
	return res.sendFile(path.join(__dirname, 'access-control.html'));
});

app.post('/api/coach/login', async (req, res) => {
	try {
		const username = cleanMetaString(req.body.username || '', 80).toLowerCase();
		const password = typeof req.body.password === 'string' ? req.body.password : '';
		const users = await readCoachUsers();
		const user = users.find((candidate) => String(candidate.username || '').toLowerCase() === username && candidate.active !== false);

		if (user && coachNeedsSetup(user)) {
			return res.status(403).json({ success: false, needsSetup: true, message: 'This account needs a password. Choose "First time? Set your password" below.' });
		}
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

// A coach account "needs setup" when it has no usable password yet.
function coachNeedsSetup(user) {
	return user && user.active !== false && (user.needsPasswordSetup === true || !user.password_hash);
}

// Coach onboarding: list active coaches who may set or reset their password.
app.get('/api/coach/setup/list', async (req, res) => {
	try {
		const users = await readCoachUsers();
		return res.json({
			success: true,
			coaches: users
				.filter((u) => u.active !== false)
				.map((u) => ({ name: u.name, username: u.username, needsSetup: coachNeedsSetup(u) }))
		});
	} catch (err) {
		console.error('Coach setup list error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading setup list' });
	}
});

// First-time onboarding: a coach claims their account with the shared code and sets a password.
app.post('/api/coach/setup', async (req, res) => {
	try {
		const username = cleanMetaString(req.body.username || '', 80).toLowerCase();
		const code = String(req.body.code || '');
		const password = typeof req.body.password === 'string' ? req.body.password : '';
		if (code.trim() !== coachSetupCode) {
			return res.status(403).json({ success: false, message: 'That setup code is not correct. Ask your admin for the code.' });
		}
		if (password.length < 6) {
			return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
		}
		const users = await readCoachUsers();
		const index = users.findIndex((u) => String(u.username || '').toLowerCase() === username);
		if (index === -1) {
			return res.status(404).json({ success: false, message: 'Coach not found. Pick your name from the list.' });
		}
		users[index] = {
			...users[index],
			password_hash: hashScryptPassword(password),
			needsPasswordSetup: false,
			updatedAt: new Date().toISOString()
		};
		await writeCoachUsers(users);
		// Propagate the new password to the coach's camp + FLL accounts so every login works.
		await syncCoachUserToProgramHubs(users[index]);
		const token = crypto.randomBytes(32).toString('hex');
		coachSessions.set(token, {
			userId: users[index].id,
			hubs: Array.isArray(users[index].hubs) ? users[index].hubs : [],
			createdAt: Date.now(),
			lastSeen: Date.now()
		});
		setCoachSessionCookie(res, token);
		return res.json({ success: true, redirectTo: '/coach-portal' });
	} catch (err) {
		console.error('Coach setup error:', err);
		return res.status(500).json({ success: false, message: 'Server error setting your password' });
	}
});

app.get('/api/coach/session', requireCoachPortalAuth, (req, res) => {
	return res.json({
		success: true,
		user: publicCoachUser(req.coachUser),
		hubs: coachVisibleHubs(req.coachUser)
	});
});

app.get('/api/coach/admin/users', requireCoachOwner, async (req, res) => {
	try {
		const users = await readCoachUsers();
		return res.json({
			success: true,
			users: users.map(publicAdminCoachUser),
			hubs: Object.values(coachHubDefinitions).map((hub) => ({
				id: hub.id,
				title: hub.title,
				category: hub.category,
				adminOnly: Boolean(hub.adminOnly)
			}))
		});
	} catch (err) {
		console.error('Coach admin users load error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading access control' });
	}
});

app.get('/api/coach/admin/data-health', requireCoachOwner, async (req, res) => {
	try {
		return res.json(await buildDataHealthReport());
	} catch (err) {
		console.error('Data health report error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading data health report' });
	}
});

app.post('/api/coach/admin/users', requireCoachOwner, async (req, res) => {
	try {
		const users = await readCoachUsers();
		const payload = sanitizeCoachAdminPayload(req.body || {}, null);
		if (!payload.name || !payload.username || !payload.password) {
			return res.status(400).json({ success: false, message: 'Name, username, and password are required' });
		}
		if (users.some((user) => String(user.username || '').toLowerCase() === payload.username)) {
			return res.status(409).json({ success: false, message: 'That username already exists' });
		}
		const user = {
			id: `coach-${slugify(payload.username)}-${crypto.randomBytes(3).toString('hex')}`,
			name: payload.name,
			username: payload.username,
			password_hash: hashScryptPassword(payload.password),
			role: payload.role,
			hubs: payload.hubs,
			fllUserId: `coach-${slugify(payload.username)}`,
			fllUsername: payload.username,
			campUserId: `camp-coach-${slugify(payload.username)}`,
			campUsername: payload.username,
			active: payload.active
		};
		users.push(user);
		await writeCoachUsers(users);
		await syncCoachUserToProgramHubs(user);
		return res.status(201).json({ success: true, user: publicAdminCoachUser(user), users: users.map(publicAdminCoachUser) });
	} catch (err) {
		console.error('Coach admin user create error:', err);
		return res.status(500).json({ success: false, message: 'Server error creating coach' });
	}
});

app.patch('/api/coach/admin/users/:id', requireCoachOwner, async (req, res) => {
	try {
		const users = await readCoachUsers();
		const index = users.findIndex((user) => user.id === req.params.id);
		if (index === -1) {
			return res.status(404).json({ success: false, message: 'Coach not found' });
		}
		const existing = users[index];
		const payload = sanitizeCoachAdminPayload(req.body || {}, existing);
		if (!payload.name || !payload.username) {
			return res.status(400).json({ success: false, message: 'Name and username are required' });
		}
		if (users.some((user) => user.id !== existing.id && String(user.username || '').toLowerCase() === payload.username)) {
			return res.status(409).json({ success: false, message: 'That username already exists' });
		}
		const updated = {
			...existing,
			name: payload.name,
			username: payload.username,
			role: payload.role,
			hubs: payload.hubs,
			fllUsername: payload.username,
			campUsername: payload.username,
			active: payload.active,
			updatedAt: new Date().toISOString()
		};
		if (payload.password) {
			updated.password_hash = hashScryptPassword(payload.password);
		}
		users[index] = updated;
		await writeCoachUsers(users);
		await syncCoachUserToProgramHubs(updated);
		return res.json({ success: true, user: publicAdminCoachUser(updated), users: users.map(publicAdminCoachUser) });
	} catch (err) {
		console.error('Coach admin user update error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating coach' });
	}
});

app.delete('/api/coach/admin/users/:id', requireCoachOwner, async (req, res) => {
	try {
		const users = await readCoachUsers();
		const index = users.findIndex((user) => user.id === req.params.id);
		if (index === -1) {
			return res.status(404).json({ success: false, message: 'Coach not found' });
		}
		if (users[index].id === req.coachUser.id) {
			return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
		}
		users[index] = { ...users[index], active: false, updatedAt: new Date().toISOString() };
		await writeCoachUsers(users);
		await syncCoachUserToProgramHubs(users[index]);
		return res.json({ success: true, users: users.map(publicAdminCoachUser) });
	} catch (err) {
		console.error('Coach admin user deactivate error:', err);
		return res.status(500).json({ success: false, message: 'Server error deactivating coach' });
	}
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
			await syncCoachUserToFllHub(req.coachUser);
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
			await syncCoachUserToCampHub(req.coachUser);
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
		const [roster, teams] = await Promise.all([
			readMasterRoster(),
			readJsonFile(path.join(fllHubDataDir, 'teams.json'), [])
		]);
		return res.json({ success: true, data: publicMasterRoster(roster, teams) });
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
		const teams = await readJsonFile(path.join(fllHubDataDir, 'teams.json'), []);
		return res.status(201).json({ success: true, data: publicMasterRoster(roster, teams), class: classItem });
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
		const teams = await readJsonFile(path.join(fllHubDataDir, 'teams.json'), []);
		return res.json({ success: true, data: publicMasterRoster(roster, teams), class: roster.classes[index] });
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
		const teams = await readJsonFile(path.join(fllHubDataDir, 'teams.json'), []);
		return res.json({ success: true, data: publicMasterRoster(roster, teams) });
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
		const portalLogin = assignStudentPortalLogin(student, roster);
		await syncMasterStudentHubAccess(student);
		await writeMasterRoster(roster);
		const teams = await readJsonFile(path.join(fllHubDataDir, 'teams.json'), []);
		return res.status(201).json({ success: true, data: publicMasterRoster(roster, teams), student, portalLogin });
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
		await syncMasterStudentHubAccess(student);
		await writeMasterRoster(roster);
		const teams = await readJsonFile(path.join(fllHubDataDir, 'teams.json'), []);
		return res.json({ success: true, data: publicMasterRoster(roster, teams), student });
	} catch (err) {
		console.error('Master student update error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating student' });
	}
});

app.delete('/api/master-roster/students/:id', requireCoachPortalAuth, async (req, res) => {
	try {
		const roster = await readMasterRoster();
		const removed = roster.students.find((item) => item.id === req.params.id);
		const before = roster.students.length;
		roster.students = roster.students.filter((item) => item.id !== req.params.id);
		if (roster.students.length === before) {
			return res.status(404).json({ success: false, message: 'Student not found' });
		}
		if (removed) {
			await removeMasterStudentLinkedAccounts(removed);
		}
		await writeMasterRoster(roster);
		const teams = await readJsonFile(path.join(fllHubDataDir, 'teams.json'), []);
		return res.json({ success: true, data: publicMasterRoster(roster, teams) });
	} catch (err) {
		console.error('Master student delete error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting student' });
	}
});

// Generate (or reset) a student's single portal login. Returns the plaintext password once.
function assignStudentPortalLogin(student, roster) {
	const taken = new Set(roster.students
		.filter((s) => s !== student)
		.map((s) => String(s.portalUsername || '').toLowerCase())
		.filter(Boolean));
	if (!student.portalUsername) student.portalUsername = uniqueUsername(student.name, taken);
	const password = generateStudentPassword();
	student.portalPassword_hash = hashScryptPassword(password);
	return { username: student.portalUsername, password };
}

// Coach: create or reset a student's central portal login (reveals the password once).
app.post('/api/master-roster/students/:id/portal-login', requireCoachPortalAuth, async (req, res) => {
	try {
		const roster = await readMasterRoster();
		const student = roster.students.find((s) => s.id === req.params.id);
		if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
		const login = assignStudentPortalLogin(student, roster);
		await writeMasterRoster(roster);
		const teams = await readJsonFile(path.join(fllHubDataDir, 'teams.json'), []);
		return res.json({ success: true, login, data: publicMasterRoster(roster, teams) });
	} catch (err) {
		console.error('Student portal login reset error:', err);
		return res.status(500).json({ success: false, message: 'Server error setting student login' });
	}
});

// ── Student central portal: pages + auth + hub bridges ──
app.get(['/student-login', '/student-login/'], (req, res) => {
	return res.sendFile(path.join(__dirname, 'student-login.html'));
});

app.get(['/student-portal', '/student-portal/'], requireStudentAuth, (req, res) => {
	return res.sendFile(path.join(__dirname, 'student-portal.html'));
});

app.post('/api/student/login', async (req, res) => {
	try {
		const classCode = normalizeClassCode(req.body.classCode || '');
		const username = cleanMetaString(req.body.username || '', 80).toLowerCase();
		const password = typeof req.body.password === 'string' ? req.body.password : '';
		if (!username) {
			return res.status(400).json({ success: false, message: 'Username is required' });
		}
		if (!classCode && !password) {
			return res.status(400).json({ success: false, message: 'Class code and username are required' });
		}
		if (classCode === 'DEMO') await ensureSummerDemoStudent();
		const roster = await ensureStudentPortalUsernames();
		let classItem = null;
		let student = null;
		if (classCode) {
			classItem = classCode === 'DEMO'
				? { id: 'demo-summer-camp', term: 'summer', name: 'Demo Summer Camp', classCode: 'DEMO', active: true }
				: (roster.classes || []).find((item) =>
					item.active !== false && normalizeClassCode(item.classCode || '') === classCode
				);
			student = roster.students.find((s) =>
				String(s.portalUsername || '').toLowerCase() === username
				&& s.active !== false
				&& classItem
				&& (classCode === 'DEMO' ? s.demoAccount === true : studentIsInClass(s, classItem.id))
			);
			if (!classItem || !student) {
				return res.status(401).json({ success: false, message: 'Check your class code and username, then try again.' });
			}
		} else {
			student = roster.students.find((s) => String(s.portalUsername || '').toLowerCase() === username && s.active !== false);
			if (!student || !student.portalPassword_hash || !verifyScryptPassword(password, student.portalPassword_hash)) {
				return res.status(401).json({ success: false, message: 'Invalid username or password' });
			}
		}
		student.lastStudentPortalLoginAt = new Date().toISOString();
		await writeMasterRoster(roster);
		if (classItem?.term === 'summer') await resolveCampAccountForStudent(student, roster);
		const token = crypto.randomBytes(32).toString('hex');
		studentPortalSessions.set(token, { studentId: student.id, createdAt: Date.now(), lastSeen: Date.now() });
		setStudentSessionCookie(res, token);
		return res.json({ success: true, redirectTo: '/student-portal' });
	} catch (err) {
		console.error('Student login error:', err);
		return res.status(500).json({ success: false, message: 'Server error signing in' });
	}
});

app.post('/api/student/logout', (req, res) => {
	const session = getStudentSession(req);
	if (session) studentPortalSessions.delete(session.token);
	clearStudentSessionCookie(res);
	return res.json({ success: true });
});

app.get('/api/student/session', requireStudentAuth, (req, res) => {
	const hubs = studentPortalHubIds(req.rosterStudent, req.masterRoster)
		.map((id) => STUDENT_HUB_DEFS[id])
		.filter(Boolean);
	return res.json({
		success: true,
		student: { name: req.rosterStudent.name, username: req.rosterStudent.portalUsername || '' },
		hubs
	});
});

app.post('/api/student/open/:hubId', requireStudentAuth, async (req, res, next) => {
	try {
		const hubId = req.params.hubId;
		const student = req.rosterStudent;
		const roster = req.masterRoster;
		if (!studentPortalHubIds(student, roster).includes(hubId)) {
			return res.status(403).json({ success: false, message: 'You are not signed up for that hub' });
		}

		if (hubId === 'fll-hub') {
			const fllUsers = await readFllUsers();
			let fllUser = student.fllUserId ? fllUsers.find((u) => u.id === student.fllUserId) : null;
			if (!fllUser) {
				const wanted = normalizedPersonName(student.name);
				fllUser = fllUsers.find((u) => u.role === 'student' && normalizedPersonName(u.name) === wanted);
			}
			if (!fllUser || fllUser.active === false) {
				return res.status(404).json({ success: false, message: 'Your FLL account is not set up yet — ask your coach.' });
			}
			createFllSessionForUser(res, fllUser);
			return res.json({ success: true, url: STUDENT_HUB_DEFS['fll-hub'].url });
		}

		if (hubId === 'summer-camp') {
			const campAccount = await resolveCampAccountForStudent(student, roster);
			if (!campAccount) {
				return res.status(404).json({ success: false, message: 'Your camp account is not set up yet — ask your coach.' });
			}
			createCampSessionForUser(res, campAccount);
			return res.json({ success: true, url: STUDENT_HUB_DEFS['summer-camp'].url });
		}

		if (hubId === 'code-lab') {
			if (!student.codeLabUserId) {
				return res.status(404).json({ success: false, message: 'Your Code Lab account is not set up yet — ask your coach.' });
			}
			req.url = '/api/internal/student-login';
			req.headers['x-coach-bridge-secret'] = codeLabApp.coachBridgeSecret;
			req.body = { studentId: student.codeLabUserId, redirectTo: STUDENT_HUB_DEFS['code-lab'].url };
			return codeLabApp(req, res, next);
		}

		return res.status(404).json({ success: false, message: 'Unknown hub' });
	} catch (err) {
		console.error('Student hub open error:', err);
		return res.status(500).json({ success: false, message: 'Server error opening hub' });
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

async function fileSha256(filePath) {
	try {
		const raw = await fs.readFile(filePath);
		return crypto.createHash('sha256').update(raw).digest('hex');
	} catch (err) {
		if (err.code === 'ENOENT') return '';
		throw err;
	}
}

async function safeJsonSummary(filePath) {
	try {
		const value = await readJsonFile(filePath, null);
		if (Array.isArray(value)) return { type: 'array', count: value.length };
		if (value && typeof value === 'object') return { type: 'object', keys: Object.keys(value).length };
		return { type: typeof value, count: 0 };
	} catch (err) {
		return { type: 'invalid-json', error: err.message };
	}
}

async function compareSeedDataFiles(label, seedDir, activeDir, fileNames, classifications = {}) {
	const rows = [];
	for (const fileName of fileNames) {
		const seedFile = path.join(seedDir, fileName);
		const activeFile = path.join(activeDir, fileName);
		const [seedHash, activeHash, seedSummary, activeSummary] = await Promise.all([
			fileSha256(seedFile),
			fileSha256(activeFile),
			safeJsonSummary(seedFile),
			safeJsonSummary(activeFile)
		]);
		rows.push({
			area: label,
			fileName,
			classification: classifications[fileName] || 'seed-backed',
			matchesSeed: Boolean(seedHash && activeHash && seedHash === activeHash),
			activeMissing: !activeHash,
			seedSummary,
			activeSummary
		});
	}
	return rows;
}

async function buildDataHealthReport() {
	const fllClassifications = {
		'fll-users.json': 'runtime-users',
		'team-members.json': 'runtime-roster',
		'teams.json': 'runtime-teams',
		'work-logs.json': 'runtime-submissions',
		'live-lesson.json': 'runtime-live-state'
	};
	const campClassifications = {
		'camp-users.json': 'managed-summer-roster',
		'curriculum.json': 'managed-lesson-building',
		'lessons.json': 'managed-lesson-building',
		'resources.json': 'managed-lesson-building-resource',
		'classroom-state.json': 'runtime-classroom',
		'live-lesson.json': 'runtime-live-state',
		'warmup-broadcast.json': 'runtime-live-state',
		'begin-lesson-responses.json': 'runtime-student-work',
		'submissions.json': 'runtime-student-work',
		'print-requests.json': 'runtime-student-work',
		'project-submissions.json': 'runtime-student-work',
		'point-events.json': 'runtime-points',
		'announcements.json': 'runtime-coach-content'
	};
	const [fllFiles, campFiles, roster] = await Promise.all([
		compareSeedDataFiles('FLL Hub', fllSeedDataDir, fllHubDataDir, fllDataFileNames, fllClassifications),
		compareSeedDataFiles('Summer Camp Hub', campSeedDataDir, campHubDataDir, campDataFileNames, campClassifications),
		readMasterRoster()
	]);
	const rosterSummary = {
		area: 'Master Roster',
		fileName: 'master-roster.json',
		classification: 'managed-summer-roster',
		summer2026Ready: hasSummer2026Roster(roster),
		activeSummerClasses: (roster.classes || []).filter((item) => item.term === 'summer' && item.active !== false).map((item) => item.name),
		summer2026Students: (roster.students || []).filter((student) => student.summerRosterSource === summerRosterSource && student.demoAccount !== true).length,
		demoStudentReady: (roster.students || []).some((student) => student.demoAccount === true && String(student.portalUsername || '').toLowerCase() === 'demo')
	};
	const findings = [...fllFiles, ...campFiles].filter((item) =>
		item.activeMissing
		|| (item.classification === 'seed-backed' && !item.matchesSeed)
		|| (item.classification.startsWith('managed') && item.activeSummary.type === 'invalid-json')
	);
	if (!rosterSummary.summer2026Ready) findings.push(rosterSummary);
	if (!rosterSummary.demoStudentReady) findings.push({ ...rosterSummary, issue: 'Demo student account is missing' });
	return {
		success: true,
		generatedAt: new Date().toISOString(),
		findings,
		files: [...fllFiles, ...campFiles],
		roster: rosterSummary
	};
}

async function logDataHealthReport() {
	try {
		const report = await buildDataHealthReport();
		const findings = Array.isArray(report.findings) ? report.findings : [];
		if (!findings.length) {
			console.log('Data health check passed: no stale seed-backed files detected.');
			return;
		}
		console.warn(`Data health check found ${findings.length} item(s) to review.`);
		for (const item of findings.slice(0, 12)) {
			console.warn(`- ${item.area || 'Data'} / ${item.fileName || 'unknown'} (${item.classification || 'unknown'})`);
		}
	} catch (err) {
		console.warn('Data health check failed:', err.message);
	}
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

async function writeFllUsers(users) {
	await writeJsonFile(fllUsersFile, Array.isArray(users) ? users : []);
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
	await migrateCampLessonBuildingData();
}

function hasLessonBuildingCurriculum(curriculum) {
	if (!Array.isArray(curriculum) || curriculum.length !== 4) return false;
	return curriculum.every((week) => {
		if (!week || week.lessonSource !== lessonBuildingSource || !Array.isArray(week.days)) return false;
		return week.days.every((day) => !day.lessonDeckUrl || String(day.lessonDeckUrl).startsWith('/camp-hub/lessons/'));
	});
}

function hasLessonBuildingLessons(lessons) {
	if (!Array.isArray(lessons)) return false;
	const lessonBuildingLessons = lessons.filter((lesson) => lesson && lesson.lessonSource === lessonBuildingSource);
	const hasIntroLesson = lessons.some((lesson) =>
		lesson
		&& lesson.id === 'lesson-0-summer-camp-intro'
		&& lesson.lessonSource === 'lesson-building-2026-intro'
		&& lesson.deckUrl === '/camp-hub/lessons/Lesson%200/lesson0_intro_slides.html'
	);
	return lessonBuildingLessons.length === 16
		&& lessonBuildingLessons.every((lesson) => lesson.deckUrl && String(lesson.deckUrl).startsWith('/camp-hub/lessons/'))
		&& hasIntroLesson;
}

async function migrateCampLessonBuildingData() {
	const seedCurriculumFile = path.join(campSeedDataDir, 'curriculum.json');
	const seedLessonsFile = path.join(campSeedDataDir, 'lessons.json');
	const seedCurriculum = await readJsonFile(seedCurriculumFile, []);
	const seedLessons = await readJsonFile(seedLessonsFile, []);
	const currentCurriculum = await readJsonFile(campCurriculumFile, []);
	const currentLessons = await readJsonFile(campLessonsFile, []);

	if (hasLessonBuildingCurriculum(seedCurriculum) && !hasLessonBuildingCurriculum(currentCurriculum)) {
		await writeJsonFile(campCurriculumFile, seedCurriculum);
	}
	if (hasLessonBuildingLessons(seedLessons) && !hasLessonBuildingLessons(currentLessons)) {
		await writeJsonFile(campLessonsFile, seedLessons);
	}

	const resourcesFile = path.join(campHubDataDir, 'resources.json');
	const resources = await readJsonFile(resourcesFile, []);
	if (Array.isArray(resources)) {
		const lessonDeckResource = {
			id: 'lesson-deck-home',
			category: 'Coach Materials',
			type: 'Folder',
			label: 'Lesson Decks',
			description: 'Exact teacher-facing HTML decks from the Lesson Building folder for Lessons 1-16.',
			url: '/camp-hub/lessons/index.html',
			roles: ['coach']
		};
		const existing = resources.find((item) => item && item.id === lessonDeckResource.id);
		if (!existing || existing.url !== lessonDeckResource.url || existing.label !== lessonDeckResource.label) {
			await writeJsonFile(resourcesFile, [
				...resources.filter((item) => item && item.id !== lessonDeckResource.id),
				lessonDeckResource
			]);
		}
	}
}

async function readCampUsers() {
	const users = await readJsonFile(campUsersFile, []);
	return Array.isArray(users) ? users : [];
}

async function writeCampUsers(users) {
	await writeJsonFile(campUsersFile, Array.isArray(users) ? users : []);
}

async function readCampSubmissions() {
	const submissions = await readJsonFile(campSubmissionsFile, []);
	return Array.isArray(submissions) ? submissions : [];
}

async function readCampPrintRequests() {
	const requests = await readJsonFile(campPrintRequestsFile, []);
	return Array.isArray(requests) ? requests : [];
}

async function readCampProjectSubmissions() {
	const projects = await readJsonFile(campProjectSubmissionsFile, []);
	return Array.isArray(projects) ? projects : [];
}

async function readCampPointEvents() {
	const events = await readJsonFile(campPointEventsFile, []);
	return Array.isArray(events) ? events : [];
}

async function readCampBeginLessonResponses() {
	const responses = await readJsonFile(campBeginLessonResponsesFile, []);
	return Array.isArray(responses) ? responses : [];
}

function beginLessonQuestionsForDay(day) {
	const source = day && typeof day === 'object' ? day : {};
	const custom = Array.isArray(source.beginLessonQuestions)
		? source.beginLessonQuestions.map((question) => cleanMetaString(question, 260)).filter(Boolean).slice(0, 3)
		: [];
	if (custom.length >= 3) return custom.slice(0, 3);
	const activity = cleanMetaString(source.activity || source.assignment || 'today\'s challenge', 220);
	const build = cleanMetaString(source.build || source.assignment || activity || 'this project', 120);
	const defaults = [
		`What part of "${activity}" sounds most interesting or surprising to you?`,
		`Before we begin, what do you predict will be the trickiest part of building or testing ${build}?`,
		`If you were the engineer leading this lesson, what would you try first and why?`
	];
	return [...custom, ...defaults].slice(0, 3);
}

function publicBeginLessonDay(day) {
	if (!day) return null;
	return {
		id: day.id,
		date: day.date || '',
		activity: day.activity || '',
		assignment: day.assignment || day.activity || '',
		build: day.build || '',
		questions: beginLessonQuestionsForDay(day)
	};
}

function findCampDay(curriculum, dayId) {
	for (const week of Array.isArray(curriculum) ? curriculum : []) {
		const day = (Array.isArray(week.days) ? week.days : []).find((candidate) => candidate.id === dayId);
		if (day) return { week, day };
	}
	return null;
}

async function findAvailableCampDayForUser(user, dayId) {
	const curriculum = await readJsonFile(campCurriculumFile, []);
	const enrollment = await getCampEnrollmentForUser(user, curriculum);
	const visibleWeek = (Array.isArray(curriculum) ? curriculum : []).find((week) => week.id === enrollment.visibleWeekId);
	const day = (visibleWeek && Array.isArray(visibleWeek.days) ? visibleWeek.days : [])
		.find((candidate) => candidate.id === dayId);
	return { curriculum, enrollment, day };
}

// ── Live lessons (slide decks broadcast to camper iPads) ──
function normalizeLessonSlide(slide) {
	const source = slide && typeof slide === 'object' ? slide : {};
	const type = source.type === 'question' ? 'question' : 'content';
	const options = Array.isArray(source.options)
		? source.options.map((opt) => cleanMetaString(opt, 160)).filter(Boolean).slice(0, 6)
		: [];
	let correctIndex = Number.isInteger(source.correctIndex) ? source.correctIndex : -1;
	if (type !== 'question' || correctIndex < 0 || correctIndex >= options.length) correctIndex = -1;
	return {
		id: cleanMetaString(source.id || `slide-${crypto.randomBytes(4).toString('hex')}`, 120),
		type,
		title: cleanMetaString(source.title || '', 160),
		body: cleanMetaString(source.body || '', 2000),
		image: cleanMetaString(source.image || '', 600),
		options: type === 'question' ? options : [],
		correctIndex
	};
}

function normalizeLesson(lesson) {
	const source = lesson && typeof lesson === 'object' ? lesson : {};
	const slides = Array.isArray(source.slides) ? source.slides.map(normalizeLessonSlide) : [];
	return {
		id: cleanMetaString(source.id || `lesson-${crypto.randomBytes(4).toString('hex')}`, 120),
		title: cleanMetaString(source.title || 'Untitled lesson', 160),
		lessonSource: cleanMetaString(source.lessonSource || '', 120),
		deckUrl: cleanMetaString(source.deckUrl || '', 1000),
		coachOnly: source.coachOnly === true,
		updatedAt: source.updatedAt || new Date().toISOString(),
		slides
	};
}

async function readCampLessons() {
	const lessons = await readJsonFile(campLessonsFile, []);
	return (Array.isArray(lessons) ? lessons : []).map(normalizeLesson);
}

async function writeCampLessons(lessons) {
	await writeJsonFile(campLessonsFile, (Array.isArray(lessons) ? lessons : []).map(normalizeLesson));
}

function defaultCampLiveLesson() {
	return {
		active: false, kind: 'slides', lessonId: '', lessonTitle: '', slides: [], currentIndex: 0, startedAt: '', responses: {},
		deckUrl: '', deckTitle: '', slideIndex: 0, slideCount: 0,
		activeQuestion: null, scoredQuestionIds: [], lastClosed: null
	};
}

function normalizeLiveQuestion(q) {
	if (!q || typeof q !== 'object') return null;
	const options = Array.isArray(q.options) ? q.options.map((opt) => cleanMetaString(opt, 160)).filter(Boolean).slice(0, 6) : [];
	if (options.length < 2) return null;
	let correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
	if (correctIndex < 0 || correctIndex >= options.length) correctIndex = -1;
	return {
		id: cleanMetaString(q.id || `liveq-${crypto.randomBytes(4).toString('hex')}`, 120),
		title: cleanMetaString(q.title || 'Question', 160),
		body: cleanMetaString(q.body || '', 2000),
		options,
		correctIndex,
		startedAt: cleanMetaString(q.startedAt || '', 80)
	};
}

function normalizeCampLiveLesson(state) {
	const fallback = defaultCampLiveLesson();
	const source = state && typeof state === 'object' ? state : {};
	const slides = Array.isArray(source.slides) ? source.slides.map(normalizeLessonSlide) : [];
	const responses = source.responses && typeof source.responses === 'object' ? source.responses : {};
	const kind = source.kind === 'deck' ? 'deck' : 'slides';
	const slideCount = Number.isInteger(source.slideCount) ? Math.max(0, source.slideCount) : 0;
	let slideIndex = Number.isInteger(source.slideIndex) ? Math.max(0, source.slideIndex) : 0;
	if (slideCount > 0) slideIndex = Math.min(slideIndex, slideCount - 1);
	const lastClosed = source.lastClosed && typeof source.lastClosed === 'object' ? {
		questionId: cleanMetaString(source.lastClosed.questionId || '', 120),
		correctIndex: Number.isInteger(source.lastClosed.correctIndex) ? source.lastClosed.correctIndex : -1,
		results: source.lastClosed.results && typeof source.lastClosed.results === 'object' ? source.lastClosed.results : {}
	} : null;
	return {
		active: source.active === true,
		kind,
		lessonId: cleanMetaString(source.lessonId || '', 120),
		lessonTitle: cleanMetaString(source.lessonTitle || '', 160),
		slides,
		currentIndex: Number.isInteger(source.currentIndex) ? Math.max(0, Math.min(source.currentIndex, Math.max(0, slides.length - 1))) : 0,
		startedAt: cleanMetaString(source.startedAt || '', 80),
		responses,
		deckUrl: cleanMetaString(source.deckUrl || '', 1000),
		deckTitle: cleanMetaString(source.deckTitle || '', 200),
		slideIndex,
		slideCount,
		activeQuestion: normalizeLiveQuestion(source.activeQuestion),
		scoredQuestionIds: Array.isArray(source.scoredQuestionIds) ? source.scoredQuestionIds.map((id) => cleanMetaString(id, 120)).filter(Boolean) : [],
		lastClosed
	};
}

async function readCampLiveLesson() {
	return normalizeCampLiveLesson(await readJsonFile(campLiveLessonFile, defaultCampLiveLesson()));
}

async function writeCampLiveLesson(state) {
	await writeJsonFile(campLiveLessonFile, normalizeCampLiveLesson(state));
}

// ── Warm-up broadcast: coach "publishes" today's warm-up so campers get a prompt ──
function defaultCampWarmupBroadcast() {
	return { active: false, dayId: '', dayLabel: '', startedAt: '' };
}

function normalizeCampWarmupBroadcast(state) {
	const source = state && typeof state === 'object' ? state : {};
	return {
		active: source.active === true,
		dayId: cleanMetaString(source.dayId || '', 120),
		dayLabel: cleanMetaString(source.dayLabel || '', 200),
		startedAt: cleanMetaString(source.startedAt || '', 80)
	};
}

async function readCampWarmupBroadcast() {
	return normalizeCampWarmupBroadcast(await readJsonFile(campWarmupBroadcastFile, defaultCampWarmupBroadcast()));
}

async function writeCampWarmupBroadcast(state) {
	await writeJsonFile(campWarmupBroadcastFile, normalizeCampWarmupBroadcast(state));
}

async function readFllLiveLesson() {
	return normalizeCampLiveLesson(await readJsonFile(fllLiveLessonFile, defaultCampLiveLesson()));
}

async function writeFllLiveLesson(state) {
	await writeJsonFile(fllLiveLessonFile, normalizeCampLiveLesson(state));
}

// Student-facing slide: never leak the correct answer.
function publicLessonSlide(slide) {
	if (!slide) return null;
	return {
		id: slide.id,
		type: slide.type,
		title: slide.title,
		body: slide.body,
		image: slide.image,
		options: slide.type === 'question' ? slide.options : []
	};
}

// Build the camper's "you just answered" result from the last-closed question.
function studentLastResult(live, studentId) {
	if (!live || !live.lastClosed || !live.lastClosed.results) return null;
	const mine = live.lastClosed.results[studentId];
	if (!mine) return null;
	return {
		questionId: live.lastClosed.questionId,
		correctIndex: live.lastClosed.correctIndex,
		correct: mine.correct === true,
		points: Number.isFinite(mine.points) ? mine.points : 0,
		choice: Number.isInteger(mine.choice) ? mine.choice : null
	};
}

function publicLiveStateForStudent(live, studentId) {
	if (!live || !live.active) return { active: false };

	// Deck mode: campers follow the teacher's HTML deck + answer pushed questions.
	if (live.kind === 'deck') {
		const aq = live.activeQuestion;
		let question = null;
		let myAnswer = null;
		if (aq) {
			const qResponses = (live.responses && live.responses[aq.id]) || {};
			const mine = qResponses[studentId];
			myAnswer = mine && Number.isInteger(mine.choice) ? mine.choice : null;
			question = { id: aq.id, title: aq.title, body: aq.body, options: aq.options, startedAt: aq.startedAt };
		}
		return {
			active: true,
			kind: 'deck',
			deckUrl: live.deckUrl,
			deckTitle: live.deckTitle,
			slideIndex: live.slideIndex,
			slideCount: live.slideCount,
			activeQuestion: question,
			myAnswer,
			lastResult: studentLastResult(live, studentId)
		};
	}

	if (!live.slides.length) return { active: false };
	const slide = live.slides[live.currentIndex] || live.slides[0];
	const slideResponses = (live.responses && live.responses[slide.id]) || {};
	const mine = slideResponses[studentId];
	return {
		active: true,
		kind: 'slides',
		lessonTitle: live.lessonTitle,
		slideIndex: live.currentIndex,
		slideCount: live.slides.length,
		startedAt: live.startedAt,
		slide: publicLessonSlide(slide),
		myAnswer: mine && Number.isInteger(mine.choice) ? mine.choice : null
	};
}

// Coach-facing tally for the current open question (deck) or current slide (text).
function liveResponseTally(live) {
	if (!live) return { total: 0, counts: [] };
	if (live.kind === 'deck') {
		const aq = live.activeQuestion;
		if (!aq) return { total: 0, counts: [] };
		const qResponses = (live.responses && live.responses[aq.id]) || {};
		const entries = Object.values(qResponses);
		const counts = (aq.options || []).map((_, i) => entries.filter((e) => e && e.choice === i).length);
		return { total: entries.length, counts };
	}
	if (!live.slides.length) return { total: 0, counts: [] };
	const slide = live.slides[live.currentIndex] || live.slides[0];
	const slideResponses = (live.responses && live.responses[slide.id]) || {};
	const entries = Object.values(slideResponses);
	const counts = (slide.options || []).map((_, i) => entries.filter((e) => e && e.choice === i).length);
	return { total: entries.length, counts };
}

function defaultCampSkills() {
	return [
		{ id: 'skill-teamwork', name: 'Teamwork', icon: '🤝', points: 1, type: 'positive' },
		{ id: 'skill-helping', name: 'Helping Others', icon: '💙', points: 1, type: 'positive' },
		{ id: 'skill-creativity', name: 'Creativity', icon: '🎨', points: 1, type: 'positive' },
		{ id: 'skill-persistence', name: 'Persistence', icon: '💪', points: 1, type: 'positive' },
		{ id: 'skill-problem-solving', name: 'Problem Solving', icon: '🧩', points: 1, type: 'positive' },
		{ id: 'skill-focused', name: 'Focused', icon: '🎯', points: 1, type: 'positive' },
		{ id: 'skill-clean-up', name: 'Clean Workspace', icon: '🧹', points: 1, type: 'positive' },
		{ id: 'skill-leadership', name: 'Leadership', icon: '⭐', points: 2, type: 'positive' },
		{ id: 'skill-off-task', name: 'Off Task', icon: '😵‍💫', points: 1, type: 'negative' },
		{ id: 'skill-not-listening', name: 'Not Listening', icon: '🙉', points: 1, type: 'negative' },
		{ id: 'skill-unkind', name: 'Unkind', icon: '💔', points: 1, type: 'negative' },
		{ id: 'skill-unsafe', name: 'Unsafe', icon: '⚠️', points: 2, type: 'negative' }
	];
}

function normalizeCampSkill(skill) {
	const source = skill && typeof skill === 'object' ? skill : {};
	const type = source.type === 'negative' ? 'negative' : 'positive';
	const points = Number.isFinite(Number(source.points)) ? Math.max(1, Math.min(10, Math.round(Math.abs(Number(source.points))))) : 1;
	return {
		id: cleanMetaString(source.id || `skill-${crypto.randomBytes(4).toString('hex')}`, 120),
		name: cleanMetaString(source.name || 'Skill', 60),
		icon: cleanMetaString(source.icon || (type === 'negative' ? '⚠️' : '⭐'), 8),
		points,
		type
	};
}

function defaultCampClassroomState() {
	return {
		noiseLevel: 'partner',
		printQueueOpen: false,
		timer: {
			label: 'Work time',
			durationMinutes: 20,
			startedAt: '',
			pausedRemainingSeconds: 20 * 60,
			running: false
		},
		groups: [],
		skills: defaultCampSkills()
	};
}

function normalizeCampClassroomState(state) {
	const fallback = defaultCampClassroomState();
	const source = state && typeof state === 'object' ? state : {};
	const timerSource = source.timer && typeof source.timer === 'object' ? source.timer : {};
	return {
		noiseLevel: ['silent', 'whisper', 'partner', 'team', 'present'].includes(source.noiseLevel) ? source.noiseLevel : fallback.noiseLevel,
		printQueueOpen: source.printQueueOpen === true,
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
		})).slice(0, 20) : [],
		skills: Array.isArray(source.skills) ? source.skills.map(normalizeCampSkill).slice(0, 40) : defaultCampSkills()
	};
}

async function readCampClassroomState() {
	return normalizeCampClassroomState(await readJsonFile(campClassroomFile, defaultCampClassroomState()));
}

function campPointsFor(studentId, submissions, printRequests, pointEvents = [], projectSubmissions = []) {
	const submittedActivities = (Array.isArray(submissions) ? submissions : [])
		.filter((item) => item.studentId === studentId).length;
	const printBonus = (Array.isArray(printRequests) ? printRequests : [])
		.filter((item) => item.studentId === studentId)
		.reduce((sum, item) => sum + (Number.isFinite(item.pointsAwarded) ? item.pointsAwarded : 0), 0);
	const projectBonus = (Array.isArray(projectSubmissions) ? projectSubmissions : [])
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
		total: submittedActivities * 10 + printBonus + projectBonus + behaviorPoints,
		submittedActivities,
		activityPoints: submittedActivities * 10,
		printBonus,
		projectBonus,
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
	return normalizeCoachUsers(Array.isArray(users) ? users : []);
}

async function writeCoachUsers(users) {
	await writeJsonFile(coachUsersFile, normalizeCoachUsers(Array.isArray(users) ? users : []));
}

function normalizeCoachUsers(users) {
	const validHubs = new Set(Object.keys(coachHubDefinitions));
	const takenUsernames = new Set();
	return users.map((user) => {
		const role = user.role === 'owner' ? 'owner' : 'coach';
		let username = String(user.username || '').toLowerCase();
		if (!username) username = uniqueUsername(user.name || 'coach', takenUsernames);
		else takenUsernames.add(username);
		const hubs = Array.isArray(user.hubs) ? user.hubs.filter((hub) => validHubs.has(hub)) : [];
		const normalizedHubs = role === 'owner'
			? Array.from(new Set([...hubs, ...adminCoachHubs]))
			: Array.from(new Set(hubs));
		return {
			...user,
			username,
			role,
			hubs: normalizedHubs,
			active: user.active !== false
		};
	});
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

function publicAdminCoachUser(user) {
	if (!user) return null;
	return {
		id: user.id,
		name: user.name,
		username: user.username,
		role: user.role === 'owner' ? 'owner' : 'coach',
		hubs: Array.isArray(user.hubs) ? user.hubs : [],
		active: user.active !== false,
		fllUsername: user.fllUsername || '',
		campUsername: user.campUsername || ''
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

function sanitizeCoachHubList(value, role) {
	const validHubs = new Set(Object.keys(coachHubDefinitions));
	const requested = Array.isArray(value) ? value : [];
	if (role === 'owner') return adminCoachHubs.slice();
	return Array.from(new Set(requested.filter((hub) => validHubs.has(hub) && !coachHubDefinitions[hub].adminOnly)));
}

function sanitizeCoachAdminPayload(body, existing) {
	const role = body.role === 'owner' ? 'owner' : 'coach';
	return {
		name: cleanMetaString(body.name ?? existing?.name ?? '', 120),
		username: cleanMetaString(body.username ?? existing?.username ?? '', 80).toLowerCase(),
		password: typeof body.password === 'string' ? body.password.trim() : '',
		role,
		hubs: sanitizeCoachHubList(body.hubs ?? existing?.hubs ?? [], role),
		active: body.active === undefined ? existing?.active !== false : body.active !== false
	};
}

function masterCoachCanAccessHub(user, hubId) {
	if (!user || user.active === false) return false;
	return coachHasHub(user, hubId);
}

function findMatchingMasterCoach(users, username, password, hubId) {
	const normalizedUsername = String(username || '').toLowerCase();
	return users.find((candidate) => {
		if (!masterCoachCanAccessHub(candidate, hubId)) return false;
		const names = [
			candidate.username,
			candidate.fllUsername,
			candidate.campUsername
		].map((value) => String(value || '').toLowerCase());
		return names.includes(normalizedUsername) && verifyScryptPassword(password, candidate.password_hash);
	}) || null;
}

async function syncCoachUserToProgramHubs(user) {
	if (!user) return;
	await Promise.all([
		syncCoachUserToFllHub(user),
		syncCoachUserToCampHub(user)
	]);
}

async function syncCoachUserToFllHub(user) {
	const shouldExist = user.active !== false && (
		coachHasHub(user, 'fll-hub') || coachHasHub(user, 'fll-competitive-curriculum')
	);
	const users = await readFllUsers();
	const username = String(user.username || user.fllUsername || '').toLowerCase();
	const existingIndex = users.findIndex((candidate) => {
		if (user.fllUserId && candidate.id === user.fllUserId) return true;
		return candidate.role === 'coach' && String(candidate.username || '').toLowerCase() === username;
	});
	if (!shouldExist) {
		if (existingIndex !== -1) {
			users[existingIndex] = { ...users[existingIndex], active: false };
			await writeFllUsers(users);
		}
		return;
	}
	const fllUser = {
		...(existingIndex === -1 ? {} : users[existingIndex]),
		id: user.fllUserId || (existingIndex === -1 ? `coach-${slugify(username)}` : users[existingIndex].id),
		name: user.name,
		username,
		password_hash: user.password_hash,
		role: 'coach',
		teamId: null,
		active: true
	};
	if (existingIndex === -1) users.unshift(fllUser);
	else users[existingIndex] = fllUser;
	await writeFllUsers(users);
}

async function syncCoachUserToCampHub(user) {
	const shouldExist = user.active !== false && (
		coachHasHub(user, 'camp-hub') || coachHasHub(user, 'summer-curriculum')
	);
	const users = await readCampUsers();
	const username = String(user.username || user.campUsername || '').toLowerCase();
	const existingIndex = users.findIndex((candidate) => {
		if (user.campUserId && candidate.id === user.campUserId) return true;
		return candidate.role === 'coach' && String(candidate.username || '').toLowerCase() === username;
	});
	if (!shouldExist) {
		if (existingIndex !== -1) {
			users[existingIndex] = { ...users[existingIndex], active: false };
			await writeCampUsers(users);
		}
		return;
	}
	const campUser = {
		...(existingIndex === -1 ? {} : users[existingIndex]),
		id: user.campUserId || (existingIndex === -1 ? `camp-coach-${slugify(username)}` : users[existingIndex].id),
		name: user.name,
		username,
		password_hash: user.password_hash,
		role: 'coach',
		className: 'Coaches',
		active: true
	};
	if (existingIndex === -1) users.unshift(campUser);
	else users[existingIndex] = campUser;
	await writeCampUsers(users);
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

async function requireCoachOwner(req, res, next) {
	try {
		const user = await getCoachUserFromSession(req);
		if (!user) {
			if (req.path.startsWith('/api/')) {
				return res.status(401).json({ success: false, message: 'Coach login required' });
			}
			return res.redirect(302, '/coach-login');
		}
		if (user.role !== 'owner' || !coachHasHub(user, 'access-control')) {
			if (req.path.startsWith('/api/')) {
				return res.status(403).json({ success: false, message: 'Owner access required' });
			}
			return res.redirect(302, '/coach-portal');
		}
		req.coachUser = user;
		return next();
	} catch (err) {
		console.error('Coach owner auth error:', err);
		return res.status(500).json({ success: false, message: 'Server error checking owner access' });
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
			{ id: 'summer-lego-robotics-1', term: 'summer', program: 'lego-robotics', name: 'Summer LEGO Robotics G2-3', classCode: 'G23', day: 'Weekly', schedule: 'Summer camp G2-3 LEGO Robotics class', active: true, createdAt: now },
			{ id: 'summer-lego-robotics-2', term: 'summer', program: 'lego-robotics', name: 'Summer LEGO Robotics G4-5', classCode: 'G45', day: 'Weekly', schedule: 'Summer camp G4-5 LEGO Robotics class', active: true, createdAt: now },
			{ id: 'summer-ftc', term: 'summer', program: 'ftc', name: 'Summer FTC Robotics G6+', classCode: 'G6PLUS', day: 'Weekly', schedule: 'Summer camp G6+ FTC robotics class', active: true, createdAt: now },
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

function summer2026RosterClasses(now = new Date().toISOString()) {
	return [
		{ id: 'summer-lego-robotics-1', term: 'summer', program: 'lego-robotics', name: 'Summer LEGO Robotics G2-3', classCode: 'G23', day: 'Weekly', schedule: 'Summer camp G2-3 LEGO Robotics class', active: true, createdAt: now, summerRosterSource },
		{ id: 'summer-lego-robotics-2', term: 'summer', program: 'lego-robotics', name: 'Summer LEGO Robotics G4-5', classCode: 'G45', day: 'Weekly', schedule: 'Summer camp G4-5 LEGO Robotics class', active: true, createdAt: now, summerRosterSource },
		{ id: 'summer-ftc', term: 'summer', program: 'ftc', name: 'Summer FTC Robotics G6+', classCode: 'G6PLUS', day: 'Weekly', schedule: 'Summer camp G6+ FTC robotics class', active: true, createdAt: now, summerRosterSource }
	];
}

function summer2026RosterStudents() {
	return [
		{ name: 'Ella Xue', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Ella Zheng', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Sam Mao', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Owen Zou', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Caitlin Lian', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Andrew Lin', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Jaiden Lin', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Anthony Shen', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Siyu Zhu', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Size Zhu', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Claire Chen', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Olivia Zhu', classId: 'summer-lego-robotics-1', gradeBand: 'G2-3' },
		{ name: 'Marcus Chen', classId: 'summer-lego-robotics-2', gradeBand: 'G4-5' },
		{ name: 'Olivia Xue', classId: 'summer-lego-robotics-2', gradeBand: 'G4-5' },
		{ name: 'Olivia Li', classId: 'summer-lego-robotics-2', gradeBand: 'G4-5' },
		{ name: 'Cailey Lian', classId: 'summer-lego-robotics-2', gradeBand: 'G4-5' },
		{ name: 'Hwjiun Ryu', classId: 'summer-lego-robotics-2', gradeBand: 'G4-5' },
		{ name: 'Jasper Zheng', classId: 'summer-lego-robotics-2', gradeBand: 'G4-5' },
		{ name: 'Kyle Tao', classId: 'summer-lego-robotics-2', gradeBand: 'G4-5' },
		{ name: 'Julisa Leung', classId: 'summer-lego-robotics-2', gradeBand: 'G4-5' },
		{ name: 'Gracelyn Pan', classId: 'summer-lego-robotics-2', gradeBand: 'G4-5' },
		{ name: 'Christina', classId: 'summer-ftc', gradeBand: 'G6+' },
		{ name: 'Aaron Zheng', classId: 'summer-ftc', gradeBand: 'G6+' },
		{ name: 'Ariel Ou', classId: 'summer-ftc', gradeBand: 'G6+' },
		{ name: 'Anthony Zhu', classId: 'summer-ftc', gradeBand: 'G6+', grade: 'G8' },
		{ name: 'Isabella Zhu', classId: 'summer-ftc', gradeBand: 'G6+', grade: 'G9' },
		{ name: 'Eli', classId: 'summer-ftc', gradeBand: 'G6+', grade: 'G9' }
	];
}

function summerDemoStudentTemplate(now = new Date().toISOString()) {
	return {
		id: summerDemoStudentId,
		name: 'Demo Student',
		parentName: '',
		email: '',
		phone: '',
		notes: 'Demo account for staff testing. Not a real camper.',
		active: true,
		demoAccount: true,
		enrollments: [{ classId: 'summer-lego-robotics-1', weeks: ['week-1'] }],
		portalUsername: 'demo',
		summerGradeBand: 'Demo',
		summerRosterSource,
		campUserId: summerDemoCampUserId,
		createdAt: now,
		updatedAt: now
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

function hasSummer2026Roster(roster) {
	const normalized = normalizeMasterRoster(roster);
	const requiredClasses = new Set(summer2026RosterClasses().map((item) => item.id));
	const activeSummerClasses = normalized.classes
		.filter((item) => item.term === 'summer' && item.active !== false)
		.map((item) => item.id);
	if (activeSummerClasses.length !== requiredClasses.size || activeSummerClasses.some((id) => !requiredClasses.has(id))) return false;
	const expected = summer2026RosterStudents();
	return expected.every((entry) => normalized.students.some((student) =>
		normalizedPersonName(student.name) === normalizedPersonName(entry.name)
		&& student.summerRosterSource === summerRosterSource
		&& (Array.isArray(student.enrollments) ? student.enrollments : []).some((enrollment) => enrollment.classId === entry.classId)
	));
}

function summerClassNameForId(classId) {
	const item = summer2026RosterClasses().find((classItem) => classItem.id === classId);
	return item ? item.name : 'Summer Camp';
}

async function migrateSummer2026RosterData() {
	const roster = await readMasterRoster();
	if (hasSummer2026Roster(roster)) return roster;

	const now = new Date().toISOString();
	const targetClasses = summer2026RosterClasses(now);
	const targetClassIds = new Set(targetClasses.map((item) => item.id));
	const allSummerClassIds = new Set([
		...targetClassIds,
		...(roster.classes || []).filter((item) => item.term === 'summer').map((item) => item.id)
	]);

	const nextClasses = (roster.classes || [])
		.filter((item) => !targetClassIds.has(item.id))
		.map((item) => item.term === 'summer' ? { ...item, active: false, updatedAt: now } : item);
	for (const classItem of targetClasses) {
		const existing = (roster.classes || []).find((item) => item.id === classItem.id);
		nextClasses.push({ ...existing, ...classItem, createdAt: existing?.createdAt || classItem.createdAt, updatedAt: now });
	}

	const students = Array.isArray(roster.students) ? roster.students.map((student) => ({ ...student })) : [];
	const studentsByName = new Map(students.map((student) => [normalizedPersonName(student.name), student]));
	const targetNames = new Set();
	const weeks = ['week-1', 'week-2', 'week-3', 'week-4'];

	for (const entry of summer2026RosterStudents()) {
		const key = normalizedPersonName(entry.name);
		targetNames.add(key);
		let student = studentsByName.get(key);
		if (!student) {
			student = {
				id: `master-summer-2026-${slugify(entry.name)}`,
				name: entry.name,
				parentName: '',
				email: '',
				phone: '',
				notes: '',
				active: true,
				enrollments: [],
				createdAt: now
			};
			students.push(student);
			studentsByName.set(key, student);
		}
		const nonSummerEnrollments = (Array.isArray(student.enrollments) ? student.enrollments : [])
			.filter((enrollment) => !allSummerClassIds.has(enrollment.classId));
		student.name = entry.name;
		student.active = true;
		student.enrollments = [...nonSummerEnrollments, { classId: entry.classId, weeks }];
		student.summerGradeBand = entry.gradeBand;
		if (entry.grade) student.grade = entry.grade;
		else if (student.grade && String(student.grade).startsWith('G')) delete student.grade;
		student.summerRosterSource = summerRosterSource;
		student.notes = appendRosterNote(student.notes || '', `Summer 2026 roster: ${entry.gradeBand}${entry.grade ? ` (${entry.grade})` : ''}; class ${summerClassNameForId(entry.classId)}.`);
		student.updatedAt = now;
	}

	for (const student of students) {
		if (student.demoAccount === true) continue;
		const key = normalizedPersonName(student.name);
		if (targetNames.has(key)) continue;
		const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
		const filtered = enrollments.filter((enrollment) => !allSummerClassIds.has(enrollment.classId));
		if (filtered.length !== enrollments.length) {
			student.enrollments = filtered;
			student.updatedAt = now;
		}
	}

	const migratedRoster = { ...roster, classes: nextClasses, students, updatedAt: now };
	await writeMasterRoster(migratedRoster);
	await syncSummer2026CampUsers(migratedRoster);
	return readMasterRoster();
}

async function ensureSummerDemoStudent() {
	const roster = await readMasterRoster();
	const now = new Date().toISOString();
	const students = Array.isArray(roster.students) ? roster.students.map((student) => ({ ...student })) : [];
	const demoIndex = students.findIndex((student) => student.id === summerDemoStudentId || String(student.portalUsername || '').toLowerCase() === 'demo');
	const existing = demoIndex >= 0 ? students[demoIndex] : {};
	const demoStudent = {
		...existing,
		...summerDemoStudentTemplate(now),
		createdAt: existing.createdAt || now,
		updatedAt: now
	};
	if (demoIndex >= 0) students[demoIndex] = demoStudent;
	else students.push(demoStudent);
	const nextRoster = { ...roster, students, updatedAt: now };
	await writeMasterRoster(nextRoster);
	await syncSummer2026CampUsers(nextRoster);
	return readMasterRoster();
}

async function syncSummer2026CampUsers(roster) {
	const now = new Date().toISOString();
	const campUsers = await readCampUsers();
	const existingUsernames = new Set(campUsers.map((user) => String(user.username || '').toLowerCase()).filter(Boolean));
	const targetNames = new Set(summer2026RosterStudents().map((entry) => normalizedPersonName(entry.name)));
	const rosterByName = new Map((roster.students || []).map((student) => [normalizedPersonName(student.name), student]));

	for (const user of campUsers) {
		if (user.demoAccount === true) continue;
		if (user.role === 'student' && !targetNames.has(normalizedPersonName(user.name)) && user.summerRosterSource !== summerRosterSource) {
			user.active = false;
			user.updatedAt = now;
		}
	}

	for (const entry of summer2026RosterStudents()) {
		const key = normalizedPersonName(entry.name);
		const rosterStudent = rosterByName.get(key);
		let account = null;
		if (rosterStudent?.campUserId) {
			account = campUsers.find((user) => user.id === rosterStudent.campUserId && user.role === 'student');
		}
		if (!account) {
			account = campUsers.find((user) => user.role === 'student' && normalizedPersonName(user.name) === key);
		}
		if (!account) {
			const username = uniqueUsername(entry.name, existingUsernames);
			existingUsernames.add(username.toLowerCase());
			account = {
				id: `camp-student-${slugify(entry.name)}`,
				username,
				password_hash: hashScryptPassword(generateStudentPassword()),
				role: 'student',
				createdAt: now
			};
			campUsers.push(account);
		}
		account.name = entry.name;
		account.active = true;
		account.className = summerClassNameForId(entry.classId);
		account.masterStudentId = rosterStudent?.id || account.masterStudentId || '';
		account.summerGradeBand = entry.gradeBand;
		if (entry.grade) account.grade = entry.grade;
		account.summerRosterSource = summerRosterSource;
		account.updatedAt = now;
		if (rosterStudent && rosterStudent.campUserId !== account.id) rosterStudent.campUserId = account.id;
	}

	const demoRosterStudent = (roster.students || []).find((student) => student.id === summerDemoStudentId || String(student.portalUsername || '').toLowerCase() === 'demo');
	let demoAccount = campUsers.find((user) => user.id === summerDemoCampUserId || user.demoAccount === true || String(user.username || '').toLowerCase() === 'demo');
	if (!demoAccount) {
		demoAccount = {
			id: summerDemoCampUserId,
			username: 'demo',
			password_hash: hashScryptPassword(generateStudentPassword()),
			role: 'student',
			createdAt: now
		};
		campUsers.push(demoAccount);
	}
	demoAccount.id = summerDemoCampUserId;
	demoAccount.name = 'Demo Student';
	demoAccount.username = 'demo';
	demoAccount.role = 'student';
	demoAccount.active = true;
	demoAccount.className = 'Demo Student';
	demoAccount.masterStudentId = demoRosterStudent?.id || summerDemoStudentId;
	demoAccount.demoAccount = true;
	demoAccount.summerGradeBand = 'Demo';
	demoAccount.summerRosterSource = summerRosterSource;
	demoAccount.updatedAt = now;
	if (demoRosterStudent && demoRosterStudent.campUserId !== demoAccount.id) demoRosterStudent.campUserId = demoAccount.id;

	await writeCampUsers(campUsers);
	await writeMasterRoster(roster);
}

function inferMasterHubAccess(student) {
	if (Array.isArray(student.hubAccess)) {
		return Array.from(new Set(student.hubAccess.filter((hub) => ['code-lab', 'fll-hub'].includes(hub))));
	}
	const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
	const access = [];
	if (student.codeLabUserId || enrollments.some((item) => item.classId === 'code-lab-students')) {
		access.push('code-lab');
	}
	if (student.fllUserId || student.fllTeamId || enrollments.some((item) => String(item.classId || '').startsWith('fll-'))) {
		access.push('fll-hub');
	}
	return access;
}

function inferMasterFllTeamId(student) {
	if (student.fllTeamId) return student.fllTeamId;
	const enrollment = (Array.isArray(student.enrollments) ? student.enrollments : [])
		.find((item) => String(item.classId || '').startsWith('fll-team-'));
	return enrollment ? String(enrollment.classId).replace(/^fll-/, '') : '';
}

function publicMasterRoster(roster, fllTeams = []) {
	const normalized = normalizeMasterRoster(roster);
	return {
		...normalized,
		fllTeams: (Array.isArray(fllTeams) ? fllTeams : []).map((team) => ({
			id: team.id,
			name: team.name || '',
			nickname: team.nickname || team.name || team.id,
			meetingDays: team.meetingDays || ''
		})),
		students: normalized.students.map((student) => ({
			id: student.id,
			name: student.name,
			parentName: student.parentName || '',
			email: student.email || '',
			phone: student.phone || '',
			notes: student.notes || '',
			active: student.active !== false,
			hubAccess: inferMasterHubAccess(student),
			codeLabUserId: student.codeLabUserId || '',
			fllUserId: student.fllUserId || '',
			campUserId: student.campUserId || '',
			fllTeamId: inferMasterFllTeamId(student),
			enrollments: Array.isArray(student.enrollments) ? student.enrollments : [],
			portalUsername: student.portalUsername || '',
			hasPortalPassword: Boolean(student.portalPassword_hash),
			portalHubs: studentPortalHubIds(student, normalized),
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
	const classCode = normalizeClassCode(body.classCode || '');
	if (!name) return null;
	return {
		id: existingId || `${term}-${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`,
		term,
		program,
		name,
		classCode,
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
	const hubAccess = Array.isArray(body.hubAccess)
		? Array.from(new Set(body.hubAccess.filter((hub) => ['code-lab', 'fll-hub'].includes(hub))))
		: inferMasterHubAccess(existing);
	const fllTeamId = hubAccess.includes('fll-hub')
		? cleanMetaString(body.fllTeamId ?? existing.fllTeamId ?? inferMasterFllTeamId(existing) ?? '', 120)
		: '';
	const enrollments = normalizeMasterEnrollments(body.enrollments ?? existing.enrollments ?? [], roster.classes, roster.settings.summerWeeks)
		.filter((enrollment) => !String(enrollment.classId || '').startsWith('fll-team-'));
	const fllClassId = fllTeamId ? `fll-${fllTeamId}` : '';
	if (fllClassId && roster.classes.some((classItem) => classItem.id === fllClassId)) {
		enrollments.push({ classId: fllClassId, weeks: [] });
	}
	return {
		id: existing.id || `student-${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`,
		name,
		parentName: cleanMetaString(body.parentName ?? existing.parentName ?? '', 120),
		email: cleanMetaString(body.email ?? existing.email ?? '', 180),
		phone: cleanMetaString(body.phone ?? existing.phone ?? '', 80),
		notes: cleanMetaString(body.notes ?? existing.notes ?? '', 600),
		active: body.active !== false,
		hubAccess,
		codeLabUserId: cleanMetaString(existing.codeLabUserId || body.codeLabUserId || '', 160),
		fllUserId: cleanMetaString(existing.fllUserId || body.fllUserId || '', 160),
		campUserId: cleanMetaString(existing.campUserId || body.campUserId || '', 160),
		fllTeamId,
		enrollments,
		portalUsername: cleanMetaString(existing.portalUsername || '', 80),
		portalPassword_hash: existing.portalPassword_hash || '',
		createdAt: existing.createdAt || now,
		updatedAt: now
	};
}

async function readCodeLabStudents() {
	const students = await readJsonFile(codeLabStudentsFile, []);
	return Array.isArray(students) ? students : [];
}

async function writeCodeLabStudents(students) {
	await writeJsonFile(codeLabStudentsFile, Array.isArray(students) ? students : []);
}

// ── Student central portal: one login → reach Code Lab / FLL / Summer Camp ──
const STUDENT_HUB_DEFS = {
	'code-lab': { id: 'code-lab', title: 'Code Lab', icon: '🧩', url: '/codelab/app', desc: 'Coding lessons, challenges, and your dashboard.' },
	'fll-hub': { id: 'fll-hub', title: 'FLL Hub', icon: '🤖', url: '/fll-hub/student', desc: 'Your FIRST LEGO League team dashboard.' },
	'summer-camp': { id: 'summer-camp', title: 'Summer Camp', icon: '☀️', url: '/camp-hub', desc: 'Daily activities, live lessons, and points.' }
};

function summerEnrolled(student, roster) {
	const summerIds = new Set((roster && Array.isArray(roster.classes) ? roster.classes : [])
		.filter((c) => c.term === 'summer').map((c) => c.id));
	return (Array.isArray(student.enrollments) ? student.enrollments : []).some((e) => summerIds.has(e.classId));
}

function studentPortalHubIds(student, roster) {
	const ids = [];
	const access = inferMasterHubAccess(student);
	if (access.includes('code-lab')) ids.push('code-lab');
	if (access.includes('fll-hub')) ids.push('fll-hub');
	if (summerEnrolled(student, roster)) ids.push('summer-camp');
	return ids;
}

function normalizeClassCode(value) {
	return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

function studentIsInClass(student, classId) {
	return (Array.isArray(student?.enrollments) ? student.enrollments : [])
		.some((enrollment) => enrollment.classId === classId);
}

function setStudentSessionCookie(res, token) {
	const maxAge = 7 * 24 * 60 * 60;
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
	res.setHeader('Set-Cookie', `${studentPortalCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
function clearStudentSessionCookie(res) {
	res.setHeader('Set-Cookie', `${studentPortalCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
function getStudentSession(req) {
	const token = parseCookies(req)[studentPortalCookie];
	if (!token) return null;
	const session = studentPortalSessions.get(token);
	if (!session) return null;
	if (Date.now() - session.lastSeen > 7 * 24 * 60 * 60 * 1000) {
		studentPortalSessions.delete(token);
		return null;
	}
	session.lastSeen = Date.now();
	return { token, ...session };
}

// Ensure every roster student has a stable portal username (passwords are set on reset).
async function ensureStudentPortalUsernames() {
	const roster = await readMasterRoster();
	const taken = new Set(roster.students.map((s) => String(s.portalUsername || '').toLowerCase()).filter(Boolean));
	let changed = false;
	for (const student of roster.students) {
		if (!student.portalUsername) {
			student.portalUsername = uniqueUsername(student.name, taken);
			taken.add(student.portalUsername.toLowerCase());
			changed = true;
		}
	}
	if (changed) await writeMasterRoster(roster);
	return roster;
}

async function requireStudentAuth(req, res, next) {
	try {
		const session = getStudentSession(req);
		if (!session) {
			if (req.path.startsWith('/api/')) return res.status(401).json({ success: false, message: 'Student login required' });
			return res.redirect(302, '/student-login');
		}
		const roster = await readMasterRoster();
		const student = roster.students.find((s) => s.id === session.studentId && s.active !== false);
		if (!student) {
			studentPortalSessions.delete(session.token);
			clearStudentSessionCookie(res);
			if (req.path.startsWith('/api/')) return res.status(401).json({ success: false, message: 'Student login required' });
			return res.redirect(302, '/student-login');
		}
		req.rosterStudent = student;
		req.masterRoster = roster;
		return next();
	} catch (err) {
		console.error('Student auth error:', err);
		return res.status(500).json({ success: false, message: 'Server error checking student session' });
	}
}

// Find or provision the camp account linked to a roster student (by stored id, then name).
async function resolveCampAccountForStudent(student, roster) {
	const campUsers = await readCampUsers();
	let account = null;
	if (student.campUserId) account = campUsers.find((u) => u.id === student.campUserId && u.role === 'student');
	if (!account) {
		const wanted = normalizedPersonName(student.name);
		account = campUsers.find((u) => u.role === 'student' && normalizedPersonName(u.name) === wanted);
	}
	if (account) {
		if (student.campUserId !== account.id) {
			const fresh = await readMasterRoster();
			const target = fresh.students.find((s) => s.id === student.id);
			if (target) { target.campUserId = account.id; await writeMasterRoster(fresh); }
		}
		return account;
	}
	// Provision a new camp account
	const existingUsernames = new Set(campUsers.map((u) => String(u.username || '').toLowerCase()));
	const username = uniqueUsername(student.name, existingUsernames);
	const summerClass = (Array.isArray(student.enrollments) ? student.enrollments : [])
		.map((e) => (roster.classes || []).find((c) => c.id === e.classId))
		.find((c) => c && c.term === 'summer');
	account = {
		id: `camp-student-${slugify(student.name)}-${crypto.randomBytes(3).toString('hex')}`,
		name: student.name,
		username,
		password_hash: hashScryptPassword(generateStudentPassword()),
		role: 'student',
		active: true,
		className: summerClass ? summerClass.name : 'Summer Camp'
	};
	campUsers.push(account);
	await writeCampUsers(campUsers);
	const fresh = await readMasterRoster();
	const target = fresh.students.find((s) => s.id === student.id);
	if (target) { target.campUserId = account.id; await writeMasterRoster(fresh); }
	return account;
}

function findStudentAccount(accounts, student, idField) {
	if (!Array.isArray(accounts) || !student) return null;
	const wantedId = student[idField];
	if (wantedId) {
		const byId = accounts.find((account) => account.id === wantedId);
		if (byId) return byId;
	}
	const studentName = normalizedPersonName(student.name);
	return accounts.find((account) =>
		account.role === 'student' && normalizedPersonName(account.name) === studentName
	) || null;
}

function appendRosterNote(notes, addition) {
	const current = cleanMetaString(notes || '', 600);
	if (!addition || current.includes(addition)) return current;
	return cleanMetaString(current ? `${current}\n${addition}` : addition, 600);
}

async function syncMasterStudentHubAccess(student) {
	if (!student || !student.name) return student;
	const access = new Set(inferMasterHubAccess(student));
	const now = new Date().toISOString();

	const codeLabStudents = await readCodeLabStudents();
	let codeLabAccount = findStudentAccount(codeLabStudents, student, 'codeLabUserId');
	if (access.has('code-lab')) {
		if (!codeLabAccount) {
			const existingUsernames = new Set(codeLabStudents.map((account) => String(account.username || '').toLowerCase()));
			const username = uniqueUsername(student.name, existingUsernames);
			const password = generateStudentPassword();
			codeLabAccount = {
				id: `student-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
				name: student.name,
				username,
				password_hash: hashScryptPassword(password),
				role: 'student',
				active: true,
				created_at: now
			};
			codeLabStudents.push(codeLabAccount);
			student.notes = appendRosterNote(student.notes, `Code Lab login created: ${username} / ${password}`);
		}
		codeLabAccount.name = student.name;
		codeLabAccount.active = true;
		student.codeLabUserId = codeLabAccount.id;
	} else if (codeLabAccount) {
		codeLabAccount.active = false;
		student.codeLabUserId = codeLabAccount.id;
	}
	await writeCodeLabStudents(codeLabStudents);

	const [fllUsers, members, teams] = await Promise.all([
		readFllUsers(),
		readJsonFile(fllTeamMembersFile, []),
		readJsonFile(path.join(fllHubDataDir, 'teams.json'), [])
	]);
	const validTeamIds = new Set((Array.isArray(teams) ? teams : []).map((team) => team.id));
	const requestedTeamId = validTeamIds.has(student.fllTeamId) ? student.fllTeamId : null;
	let fllAccount = findStudentAccount(fllUsers, student, 'fllUserId');

	if (access.has('fll-hub')) {
		if (!fllAccount) {
			const existingUsernames = new Set(fllUsers.map((account) => String(account.username || '').toLowerCase()));
			const username = uniqueUsername(student.name, existingUsernames);
			const password = generateStudentPassword();
			fllAccount = {
				id: `student-${slugify(student.name)}-${crypto.randomBytes(3).toString('hex')}`,
				name: student.name,
				username,
				password_hash: hashScryptPassword(password),
				role: 'student',
				teamId: requestedTeamId,
				active: true
			};
			fllUsers.push(fllAccount);
			student.notes = appendRosterNote(student.notes, `FLL Hub login created: ${username} / ${password}`);
		}
		fllAccount.name = student.name;
		fllAccount.teamId = requestedTeamId;
		fllAccount.active = true;
		student.fllUserId = fllAccount.id;
		student.fllTeamId = requestedTeamId || '';
	} else if (fllAccount) {
		fllAccount.active = false;
		fllAccount.teamId = null;
		student.fllUserId = fllAccount.id;
		student.fllTeamId = '';
	}

	if (fllAccount) {
		const existingMember = members.find((member) => member.studentId === fllAccount.id);
		if (access.has('fll-hub') && requestedTeamId) {
			if (existingMember) {
				existingMember.teamId = requestedTeamId;
				existingMember.displayName = student.name;
				existingMember.initials = initialsFromName(student.name);
			} else {
				members.push({
					teamId: requestedTeamId,
					studentId: fllAccount.id,
					displayName: student.name,
					role: 'Team member',
					initials: initialsFromName(student.name)
				});
			}
		} else if (existingMember) {
			members.splice(members.indexOf(existingMember), 1);
		}
	}

	await Promise.all([
		writeJsonFile(fllUsersFile, fllUsers),
		writeJsonFile(fllTeamMembersFile, members)
	]);

	return student;
}

// Fully remove the Code Lab and FLL Hub accounts that were provisioned for a
// master-roster student. Used when the student is deleted from the roster, so no
// deactivated orphan accounts linger. Matching reuses findStudentAccount (stored
// id first, then a same-name student fallback) — the same link the sync trusts.
async function removeMasterStudentLinkedAccounts(student) {
	if (!student) return;

	const codeLabStudents = await readCodeLabStudents();
	const codeLabAccount = findStudentAccount(codeLabStudents, student, 'codeLabUserId');
	if (codeLabAccount) {
		await writeCodeLabStudents(codeLabStudents.filter((account) => account.id !== codeLabAccount.id));
	}

	const [fllUsers, members] = await Promise.all([
		readFllUsers(),
		readJsonFile(fllTeamMembersFile, [])
	]);
	const fllAccount = findStudentAccount(fllUsers, student, 'fllUserId');
	if (fllAccount) {
		await Promise.all([
			writeJsonFile(fllUsersFile, fllUsers.filter((account) => account.id !== fllAccount.id)),
			writeJsonFile(fllTeamMembersFile, (Array.isArray(members) ? members : []).filter((member) => member.studentId !== fllAccount.id))
		]);
	}
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
			if (user.demoAccount === true || masterStudent.demoAccount === true) {
				enrolledWeekIds = validWeekIds.has('week-1') ? ['week-1'] : [];
			} else {
				const weeks = [];
				for (const enrollment of (Array.isArray(masterStudent.enrollments) ? masterStudent.enrollments : [])) {
					const classItem = classesById.get(enrollment.classId);
					if (classItem && classItem.term === 'summer') {
						weeks.push(...(Array.isArray(enrollment.weeks) ? enrollment.weeks : []));
					}
				}
				enrolledWeekIds = mapRosterWeeksToCurriculumWeekIds(weeks, roster.settings.summerWeeks, curriculumWeeks)
					.filter((weekId) => validWeekIds.has(weekId));
			}
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
	const [camp, curriculum, announcements, resources, submissions, printRequests, projectSubmissions, pointEvents, classroom, beginLessonResponses, campUsers] = await Promise.all([
		readJsonFile(path.join(campHubDataDir, 'camp.json'), {}),
		readJsonFile(campCurriculumFile, []),
		readJsonFile(campAnnouncementsFile, []),
		readJsonFile(path.join(campHubDataDir, 'resources.json'), []),
		readCampSubmissions(),
		readCampPrintRequests(),
		readCampProjectSubmissions(),
		readCampPointEvents(),
		readCampClassroomState(),
		readCampBeginLessonResponses(),
		readCampUsers()
	]);
	const isCoach = user.role === 'coach';
	// Classmates (same class) with point totals — powers the camper class board.
	const myClassName = user.className || '';
	const classmates = isCoach ? [] : (Array.isArray(campUsers) ? campUsers : [])
		.filter((u) => u.role === 'student' && u.active !== false && (u.className || '') === myClassName)
		.map((u) => ({
			id: u.id,
			name: u.name,
			isMe: u.id === user.id,
			points: campPointsFor(u.id, submissions, printRequests, pointEvents, projectSubmissions).total
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
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
			const { coachNotes, lessonDeckUrl, worksheetLabel, worksheetUrl, ...studentDay } = day;
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
		className: myClassName,
		classmates,
		points: isCoach ? null : campPointsFor(user.id, submissions, printRequests, pointEvents, projectSubmissions),
		printRequests: isCoach ? [] : printRequests.filter((item) => item.studentId === user.id),
		projectSubmissions: isCoach ? [] : projectSubmissions.filter((item) => item.studentId === user.id),
		beginLessonResponses: isCoach
			? []
			: beginLessonResponses.filter((item) => item.studentId === user.id && visibleCurriculum.some((week) => (week.days || []).some((day) => day.id === item.dayId))),
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

function buildFllCodingFoundationsTask(user) {
	const studentId = user?.id || 'student';
	return {
		id: `task-coding-foundations-${studentId}`,
		assignmentId: 'assignment-coding-foundations',
		teamId: user?.teamId || '',
		assignedTo: studentId,
		title: 'Coding Foundations Check: Pybricks Logic and PID',
		description: [
			'This check helps coaches understand how you reason about robot code. Focus on explaining your thinking, not just naming a command.',
			'Use complete thoughts. If you are unsure, write what you would test on the robot and what evidence would prove your idea.',
			'Topics include Python/Pybricks logic, loops, conditionals, gyro turns, encoder distance, speed, acceleration, and the basic idea of PID control.'
		].join('\n\n'),
		category: 'Robot Game',
		section: 'robot-game',
		type: 'lesson',
		workContext: 'home',
		status: 'todo',
		dueDate: '2026-07-22',
		codeExample: [
			'from pybricks.hubs import PrimeHub',
			'from pybricks.pupdevices import Motor',
			'from pybricks.parameters import Port, Direction',
			'from pybricks.tools import wait',
			'',
			'hub = PrimeHub()',
			'left = Motor(Port.A, Direction.COUNTERCLOCKWISE)',
			'right = Motor(Port.B)',
			'',
			'target_angle = 0',
			'base_speed = 350',
			'kp = 4',
			'',
			'left.reset_angle(0)',
			'right.reset_angle(0)',
			'hub.imu.reset_heading(0)',
			'',
			'while (abs(left.angle()) + abs(right.angle())) / 2 < 720:',
			'    error = target_angle - hub.imu.heading()',
			'    correction = kp * error',
			'    left.run(base_speed - correction)',
			'    right.run(base_speed + correction)',
			'    wait(10)',
			'',
			'left.stop()',
			'right.stop()'
		].join('\n'),
		questions: [
			{
				id: 'logic-flow',
				type: 'textarea',
				label: 'Read the code. Explain the logic of the while loop in your own words. What condition keeps it running, and what condition makes it stop?',
				placeholder: 'Mention the encoder angles, the average distance, and why the robot eventually exits the loop...'
			},
			{
				id: 'gyro-error',
				type: 'textarea',
				label: 'The robot wants to drive straight at heading 0. If hub.imu.heading() reads -6 degrees, what is the error? Which side should speed up or slow down, and why?',
				placeholder: 'Show the error calculation and explain the correction in robot movement words...'
			},
			{
				id: 'if-logic',
				type: 'textarea',
				label: 'Write pseudocode or Python logic for this idea: if the gyro heading is more than 3 degrees to the right, adjust left and right motor speeds to turn back toward the target; otherwise keep driving straight.',
				placeholder: 'Use if / else logic. It does not need to be perfect Pybricks syntax, but the reasoning should be clear...'
			},
			{
				id: 'speed-acceleration',
				type: 'textarea',
				label: 'Explain the difference between speed and acceleration for an FLL robot. Why might a robot miss a mission if it jumps instantly to a very high speed?',
				placeholder: 'Think about wheel slip, attachments shaking, stopping distance, and repeatability...'
			},
			{
				id: 'encoder-reasoning',
				type: 'textarea',
				label: 'A robot drives forward until the average motor encoder angle reaches 720 degrees. What does using the average of left and right encoders protect against? What problem could still happen?',
				placeholder: 'Reason about one wheel moving more than the other, drift, wheel slip, or the robot being bumped...'
			},
			{
				id: 'pid-concepts',
				type: 'textarea',
				label: 'In PID control, what do P, I, and D each try to fix? Give a robot example for at least P and D.',
				placeholder: 'P reacts to current error, I reacts to error that builds up over time, D reacts to how fast error is changing...'
			},
			{
				id: 'debug-plan',
				type: 'textarea',
				label: 'Your robot turns past the target angle every time. What are two code or tuning changes you would try, and what data would you collect to decide if it improved?',
				placeholder: 'Think about lowering kp, adding D, slowing speed, logging gyro angle, testing multiple runs...'
			},
			{
				id: 'foundation-reflection',
				type: 'text',
				label: 'What is one coding concept from this check that you want more practice with?',
				placeholder: 'Loops, if statements, Pybricks syntax, gyro, encoders, PID, debugging...'
			}
		],
		createdBy: 'system-coding-foundations',
		createdAt: '2026-06-17T00:00:00.000Z',
		updatedAt: '2026-06-17T00:00:00.000Z'
	};
}

function isGeneratedFllCodingTaskId(taskId, user) {
	return taskId === `task-coding-foundations-${user?.id || ''}`;
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
	const codingFoundationsTask = buildFllCodingFoundationsTask(user);
	if (!myTasks.some((task) => task.id === codingFoundationsTask.id)) {
		myTasks.push(codingFoundationsTask);
		myTasks.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
	}
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
		const [users, coachUsers] = await Promise.all([readFllUsers(), readCoachUsers()]);
		let user = users.find((candidate) => candidate.username.toLowerCase() === username && candidate.active !== false);
		const masterCoach = findMatchingMasterCoach(coachUsers, username, password, 'fll-hub')
			|| findMatchingMasterCoach(coachUsers, username, password, 'fll-competitive-curriculum');

		if (masterCoach) {
			await syncCoachUserToFllHub(masterCoach);
			const syncedUsers = await readFllUsers();
			user = syncedUsers.find((candidate) => {
				if (masterCoach.fllUserId && candidate.id === masterCoach.fllUserId) return true;
				return candidate.role === 'coach' && String(candidate.username || '').toLowerCase() === String(masterCoach.fllUsername || masterCoach.username || '').toLowerCase();
			});
		} else if (!user || !verifyScryptPassword(password, user.password_hash)) {
			return res.status(401).json({ success: false, message: 'Invalid FLL username or password' });
		}

		if (!user || user.active === false) {
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

app.get('/api/fll/live', requireFllAuth, requireFllStudent, async (req, res) => {
	try {
		const live = await readFllLiveLesson();
		return res.json({ success: true, state: publicLiveStateForStudent(live, req.fllUser.id) });
	} catch (err) {
		console.error('FLL live state error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading live lesson' });
	}
});

app.post('/api/fll/live/answer', requireFllAuth, requireFllStudent, async (req, res) => {
	try {
		const live = await readFllLiveLesson();
		if (!live.active || !live.slides.length) return res.status(400).json({ success: false, message: 'No lesson is live' });
		const slideId = cleanMetaString(req.body.slideId || '', 120);
		const current = live.slides[live.currentIndex];
		if (!current || current.id !== slideId || current.type !== 'question') {
			return res.status(400).json({ success: false, message: 'That question is not open' });
		}
		const choice = Number(req.body.choice);
		if (!Number.isInteger(choice) || choice < 0 || choice >= current.options.length) {
			return res.status(400).json({ success: false, message: 'Invalid choice' });
		}
		if (!live.responses[slideId]) live.responses[slideId] = {};
		live.responses[slideId][req.fllUser.id] = { choice, name: req.fllUser.name, at: new Date().toISOString() };
		await writeFllLiveLesson(live);
		return res.json({ success: true, myAnswer: choice });
	} catch (err) {
		console.error('FLL live answer error:', err);
		return res.status(500).json({ success: false, message: 'Server error submitting answer' });
	}
});

app.get('/api/fll/coach/live', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const live = await readFllLiveLesson();
		return res.json({ success: true, live, tally: liveResponseTally(live) });
	} catch (err) {
		console.error('FLL coach live load error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading live lesson' });
	}
});

app.post('/api/fll/coach/live/start', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const live = await readFllLiveLesson();
		if (!live.slides.length) return res.status(400).json({ success: false, message: 'No slides are available to present' });
		live.active = true;
		live.kind = 'slides';
		live.currentIndex = 0;
		live.startedAt = new Date().toISOString();
		live.responses = live.responses && typeof live.responses === 'object' ? live.responses : {};
		await writeFllLiveLesson(live);
		return res.json({ success: true, live, tally: liveResponseTally(live) });
	} catch (err) {
		console.error('FLL coach live start error:', err);
		return res.status(500).json({ success: false, message: 'Server error starting live lesson' });
	}
});

app.post('/api/fll/coach/live/slide', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const live = await readFllLiveLesson();
		if (!live.slides.length) return res.status(400).json({ success: false, message: 'No slides are available' });
		const index = Number(req.body.index);
		if (!Number.isInteger(index) || index < 0 || index >= live.slides.length) {
			return res.status(400).json({ success: false, message: 'Invalid slide index' });
		}
		live.active = true;
		live.kind = 'slides';
		live.currentIndex = index;
		if (!live.startedAt) live.startedAt = new Date().toISOString();
		await writeFllLiveLesson(live);
		return res.json({ success: true, live, tally: liveResponseTally(live) });
	} catch (err) {
		console.error('FLL coach live slide error:', err);
		return res.status(500).json({ success: false, message: 'Server error changing slide' });
	}
});

app.post('/api/fll/coach/live/stop', requireFllAuth, requireFllCoach, async (req, res) => {
	try {
		const live = await readFllLiveLesson();
		live.active = false;
		await writeFllLiveLesson(live);
		return res.json({ success: true, live, tally: liveResponseTally(live) });
	} catch (err) {
		console.error('FLL coach live stop error:', err);
		return res.status(500).json({ success: false, message: 'Server error stopping live lesson' });
	}
});

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
			.filter((user) => user.role === 'student' && user.demoAccount !== true)
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
		let task = tasks.find((candidate) => candidate.id === req.params.id);
		if (!task && isGeneratedFllCodingTaskId(req.params.id, req.fllUser)) {
			task = buildFllCodingFoundationsTask(req.fllUser);
			tasks.push(task);
		}
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
		let task = tasks.find((candidate) => candidate.id === req.params.id);
		if (!task && isGeneratedFllCodingTaskId(req.params.id, req.fllUser)) {
			task = buildFllCodingFoundationsTask(req.fllUser);
			tasks.push(task);
			await writeJsonFile(fllTasksFile, tasks);
		}
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
	const localApiPrefixes = [
		'/coach/',
		'/master-roster',
		'/student/',
		'/parent-inquiry',
		'/summer-inquiry',
		'/summer-traffic',
		'/fll/'
	];
	if (localApiPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(prefix))) return next();
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

app.get('/camp-hub/lessons', requireCampAuth, (req, res) => {
	if (req.campUser.role !== 'coach') {
		return res.status(403).send('Coach access required');
	}
	return res.redirect(302, '/camp-hub/lessons/index.html');
});

// Coaches browse the deck index; campers' iframes load individual deck files when
// a deck is being presented live (teacher notes are hidden client-side in the camper view).
app.use('/camp-hub/lessons', requireCampAuth, (req, res, next) => {
	if (req.campUser.role === 'coach') return next();
	// Campers may only load actual deck HTML/assets, not the coach-facing index listing.
	if (req.path === '/' || req.path === '' || /index\.html?$/i.test(req.path)) {
		return res.status(403).send('Coach access required');
	}
	return next();
}, express.static(lessonBuildingDir, {
	index: ['index.html'],
	etag: true,
	lastModified: true
}));

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
		const [users, coachUsers] = await Promise.all([readCampUsers(), readCoachUsers()]);
		let user = users.find((candidate) => candidate.username.toLowerCase() === username && candidate.active !== false);
		const masterCoach = findMatchingMasterCoach(coachUsers, username, password, 'camp-hub')
			|| findMatchingMasterCoach(coachUsers, username, password, 'summer-curriculum');

		if (masterCoach) {
			await syncCoachUserToCampHub(masterCoach);
			const syncedUsers = await readCampUsers();
			user = syncedUsers.find((candidate) => {
				if (masterCoach.campUserId && candidate.id === masterCoach.campUserId) return true;
				return candidate.role === 'coach' && String(candidate.username || '').toLowerCase() === String(masterCoach.campUsername || masterCoach.username || '').toLowerCase();
			});
		} else if (!user || !verifyScryptPassword(password, user.password_hash)) {
			return res.status(401).json({ success: false, message: 'Invalid camp username or password' });
		}

		if (!user || user.active === false) {
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

app.get('/api/camp/begin-lesson/:dayId', requireCampAuth, async (req, res) => {
	try {
		if (!req.campUser || req.campUser.role !== 'student') {
			return res.status(403).json({ success: false, message: 'Camper access required' });
		}
		const dayId = cleanMetaString(req.params.dayId || '', 120);
		const { day } = await findAvailableCampDayForUser(req.campUser, dayId);
		if (!day) {
			return res.status(404).json({ success: false, message: 'Lesson warm-up is not available for your current camp week' });
		}
		const responses = await readCampBeginLessonResponses();
		const response = responses.find((item) => item.dayId === dayId && item.studentId === req.campUser.id) || null;
		return res.json({ success: true, day: publicBeginLessonDay(day), response });
	} catch (err) {
		console.error('Camp begin lesson load error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading begin lesson questions' });
	}
});

app.post('/api/camp/begin-lesson/:dayId', requireCampAuth, async (req, res) => {
	try {
		if (!req.campUser || req.campUser.role !== 'student') {
			return res.status(403).json({ success: false, message: 'Camper access required' });
		}
		const dayId = cleanMetaString(req.params.dayId || '', 120);
		const { day } = await findAvailableCampDayForUser(req.campUser, dayId);
		if (!day) {
			return res.status(404).json({ success: false, message: 'Lesson warm-up is not available for your current camp week' });
		}
		const questions = beginLessonQuestionsForDay(day);
		const answers = Array.isArray(req.body.answers)
			? req.body.answers.map((answer) => cleanMetaString(answer, 900)).slice(0, questions.length)
			: [];
		if (answers.length !== questions.length || answers.some((answer) => !answer.trim())) {
			return res.status(400).json({ success: false, message: 'Answer every warm-up question before beginning the lesson' });
		}
		const responses = await readCampBeginLessonResponses();
		const now = new Date().toISOString();
		const existing = responses.find((item) => item.dayId === dayId && item.studentId === req.campUser.id);
		const payload = {
			id: existing?.id || `begin-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
			dayId,
			studentId: req.campUser.id,
			studentName: req.campUser.name,
			className: req.campUser.className || 'Unassigned',
			questions,
			answers,
			updatedAt: now,
			submittedAt: existing?.submittedAt || now
		};
		if (existing) Object.assign(existing, payload);
		else responses.push(payload);
		await writeJsonFile(campBeginLessonResponsesFile, responses);
		return res.status(existing ? 200 : 201).json({ success: true, response: payload });
	} catch (err) {
		console.error('Camp begin lesson save error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving begin lesson answers' });
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
		const classroom = await readCampClassroomState();
		if (classroom.printQueueOpen !== true) {
			return res.status(403).json({ success: false, message: '3D print requests are closed right now. Ask your coach when the queue will open.' });
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

app.post('/api/camp/projects', requireCampAuth, async (req, res) => {
	try {
		if (!req.campUser || req.campUser.role !== 'student') {
			return res.status(403).json({ success: false, message: 'Camper access required' });
		}
		const title = cleanMetaString(req.body.title || '', 140);
		const projectType = cleanMetaString(req.body.projectType || '', 80) || 'Project';
		const description = cleanMetaString(req.body.description || '', 1200);
		const reflection = cleanMetaString(req.body.reflection || '', 1200);
		const linkUrl = cleanMetaString(req.body.linkUrl || '', 1000);
		const photoDataUrl = typeof req.body.photoDataUrl === 'string' ? req.body.photoDataUrl : '';
		if (!title || !description) {
			return res.status(400).json({ success: false, message: 'Project title and description are required' });
		}
		if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
			return res.status(400).json({ success: false, message: 'Project link must start with http:// or https://' });
		}
		if (photoDataUrl && (!photoDataUrl.startsWith('data:image/') || photoDataUrl.length > 8 * 1024 * 1024)) {
			return res.status(400).json({ success: false, message: 'Photo must be an image under 8 MB after compression' });
		}
		const projects = await readCampProjectSubmissions();
		const now = new Date().toISOString();
		const project = {
			id: `project-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
			studentId: req.campUser.id,
			studentName: req.campUser.name,
			className: req.campUser.className || 'Unassigned',
			title,
			projectType,
			description,
			reflection,
			linkUrl,
			photoDataUrl,
			status: 'submitted',
			pointsAwarded: 0,
			coachFeedback: '',
			createdAt: now,
			updatedAt: now
		};
		projects.push(project);
		await writeJsonFile(campProjectSubmissionsFile, projects);
		const [submissions, printRequests, pointEvents] = await Promise.all([readCampSubmissions(), readCampPrintRequests(), readCampPointEvents()]);
		return res.status(201).json({
			success: true,
			project,
			points: campPointsFor(req.campUser.id, submissions, printRequests, pointEvents, projects)
		});
	} catch (err) {
		console.error('Camp project submission error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving project' });
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
				if (typeof req.body.lessonDeckUrl === 'string') day.lessonDeckUrl = cleanMetaString(req.body.lessonDeckUrl, 1000);
				if (Array.isArray(req.body.beginLessonQuestions)) {
					day.beginLessonQuestions = req.body.beginLessonQuestions
						.map((question) => cleanMetaString(question, 260))
						.filter(Boolean)
						.slice(0, 3);
				}
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

app.get('/api/camp/coach/begin-lesson-responses', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const dayId = cleanMetaString(req.query.dayId || '', 120);
		const [curriculum, responses, users, warmup] = await Promise.all([
			readJsonFile(campCurriculumFile, []),
			readCampBeginLessonResponses(),
			readCampUsers(),
			readCampWarmupBroadcast()
		]);
		const match = dayId ? findCampDay(curriculum, dayId) : null;
		if (dayId && !match) {
			return res.status(404).json({ success: false, message: 'Camp day not found' });
		}
		const day = match?.day || null;
		const questions = day ? beginLessonQuestionsForDay(day) : [];
		const dayResponses = dayId ? responses.filter((item) => item.dayId === dayId) : [];
		const studentUsers = users.filter((user) => user.role === 'student' && user.active !== false);
		const answeredIds = new Set(dayResponses.map((item) => item.studentId));
		const unanswered = studentUsers
			.filter((user) => !answeredIds.has(user.id))
			.map((user) => ({ id: user.id, name: user.name, className: user.className || 'Unassigned' }));
		const byQuestion = questions.map((question, index) => ({
			question,
			answers: dayResponses.map((response) => ({
				studentId: response.studentId,
				studentName: response.studentName,
				className: response.className || 'Unassigned',
				answer: response.answers?.[index] || '',
				updatedAt: response.updatedAt || response.submittedAt || ''
			})).filter((item) => item.answer)
		}));
		return res.json({
			success: true,
			day: day ? publicBeginLessonDay(day) : null,
			totalStudents: studentUsers.length,
			answeredCount: dayResponses.length,
			unanswered,
			responses: dayResponses,
			byQuestion,
			published: !!(warmup.active && dayId && warmup.dayId === dayId),
			publishedDayId: warmup.active ? warmup.dayId : ''
		});
	} catch (err) {
		console.error('Camp begin lesson coach responses error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading warm-up responses' });
	}
});

// Coach "publishes" a day's warm-up so campers get a live prompt to answer it.
app.post('/api/camp/coach/warmup/publish', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const dayId = cleanMetaString(req.body.dayId || '', 120);
		if (!dayId) return res.status(400).json({ success: false, message: 'Pick a day to publish' });
		const curriculum = await readJsonFile(campCurriculumFile, []);
		const match = findCampDay(curriculum, dayId);
		if (!match || !match.day) return res.status(404).json({ success: false, message: 'Camp day not found' });
		const day = match.day;
		const dayLabel = cleanMetaString(day.build || day.assignment || day.activity || 'today’s warm-up', 200);
		const broadcast = { active: true, dayId, dayLabel, startedAt: new Date().toISOString() };
		await writeCampWarmupBroadcast(broadcast);
		return res.json({ success: true, warmup: broadcast });
	} catch (err) {
		console.error('Camp warmup publish error:', err);
		return res.status(500).json({ success: false, message: 'Server error publishing warm-up' });
	}
});

app.post('/api/camp/coach/warmup/stop', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		await writeCampWarmupBroadcast(defaultCampWarmupBroadcast());
		return res.json({ success: true, warmup: { active: false } });
	} catch (err) {
		console.error('Camp warmup stop error:', err);
		return res.status(500).json({ success: false, message: 'Server error stopping warm-up' });
	}
});

// Camper poll: is my coach asking me to answer today's warm-up right now?
app.get('/api/camp/warmup', requireCampAuth, async (req, res) => {
	try {
		const broadcast = await readCampWarmupBroadcast();
		if (!broadcast.active || !broadcast.dayId) return res.json({ success: true, state: { active: false } });
		// Only prompt the camper if the published day is actually available to them.
		const { day } = await findAvailableCampDayForUser(req.campUser, broadcast.dayId);
		if (!day) return res.json({ success: true, state: { active: false } });
		return res.json({
			success: true,
			state: { active: true, dayId: broadcast.dayId, dayLabel: broadcast.dayLabel, day: publicBeginLessonDay(day) }
		});
	} catch (err) {
		console.error('Camp warmup state error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading warm-up state' });
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

// ── ClassDojo-style skills (positive + negative) ──
app.post('/api/camp/coach/skills', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const state = await readCampClassroomState();
		if (!cleanMetaString(req.body.name || '', 60)) {
			return res.status(400).json({ success: false, message: 'Skill name is required' });
		}
		const incoming = normalizeCampSkill(req.body);
		const existingId = cleanMetaString(req.body.id || '', 120);
		const index = existingId ? state.skills.findIndex((s) => s.id === existingId) : -1;
		if (index >= 0) {
			incoming.id = state.skills[index].id;
			state.skills[index] = incoming;
		} else {
			state.skills.push(incoming);
		}
		const next = normalizeCampClassroomState(state);
		await writeJsonFile(campClassroomFile, next);
		return res.status(index >= 0 ? 200 : 201).json({ success: true, classroom: next, skill: incoming });
	} catch (err) {
		console.error('Camp skill save error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving skill' });
	}
});

app.delete('/api/camp/coach/skills/:id', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const state = await readCampClassroomState();
		const before = state.skills.length;
		state.skills = state.skills.filter((s) => s.id !== req.params.id);
		if (state.skills.length === before) {
			return res.status(404).json({ success: false, message: 'Skill not found' });
		}
		await writeJsonFile(campClassroomFile, state);
		return res.json({ success: true, classroom: state });
	} catch (err) {
		console.error('Camp skill delete error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting skill' });
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

// ── Live lessons: coach authoring + presenting ──
app.get('/api/camp/coach/lessons', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const [lessons, live] = await Promise.all([readCampLessons(), readCampLiveLesson()]);
		return res.json({ success: true, lessons, live: { active: live.active, lessonId: live.lessonId, currentIndex: live.currentIndex, slideCount: live.slides.length } });
	} catch (err) {
		console.error('Camp lessons load error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading lessons' });
	}
});

app.post('/api/camp/coach/lessons', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const title = cleanMetaString(req.body.title || '', 160);
		if (!title) return res.status(400).json({ success: false, message: 'Lesson title is required' });
		const lessons = await readCampLessons();
		const incoming = normalizeLesson({ ...req.body, title, updatedAt: new Date().toISOString() });
		const existingId = cleanMetaString(req.body.id || '', 120);
		const index = existingId ? lessons.findIndex((l) => l.id === existingId) : -1;
		if (index >= 0) {
			incoming.id = lessons[index].id;
			lessons[index] = incoming;
		} else {
			lessons.push(incoming);
		}
		await writeCampLessons(lessons);
		return res.status(index >= 0 ? 200 : 201).json({ success: true, lessons, lesson: incoming });
	} catch (err) {
		console.error('Camp lesson save error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving lesson' });
	}
});

app.delete('/api/camp/coach/lessons/:id', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const lessons = await readCampLessons();
		const remaining = lessons.filter((l) => l.id !== req.params.id);
		if (remaining.length === lessons.length) return res.status(404).json({ success: false, message: 'Lesson not found' });
		await writeCampLessons(remaining);
		// If the deleted lesson was live, stop the broadcast.
		const live = await readCampLiveLesson();
		if (live.lessonId === req.params.id && live.active) {
			await writeCampLiveLesson({ ...live, active: false });
		}
		return res.json({ success: true, lessons: remaining });
	} catch (err) {
		console.error('Camp lesson delete error:', err);
		return res.status(500).json({ success: false, message: 'Server error deleting lesson' });
	}
});

app.get('/api/camp/coach/live', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const live = await readCampLiveLesson();
		return res.json({ success: true, live, tally: liveResponseTally(live) });
	} catch (err) {
		console.error('Camp live load error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading live lesson' });
	}
});

app.post('/api/camp/coach/live/start', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const lessonId = cleanMetaString(req.body.lessonId || '', 120);
		const lessons = await readCampLessons();
		const lesson = lessons.find((l) => l.id === lessonId);
		if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found' });
		if (!lesson.slides.length) return res.status(400).json({ success: false, message: 'Add at least one slide before starting' });
		const live = normalizeCampLiveLesson({
			active: true,
			lessonId: lesson.id,
			lessonTitle: lesson.title,
			slides: lesson.slides,
			currentIndex: 0,
			startedAt: new Date().toISOString(),
			responses: {}
		});
		await writeCampLiveLesson(live);
		return res.json({ success: true, live, tally: liveResponseTally(live) });
	} catch (err) {
		console.error('Camp live start error:', err);
		return res.status(500).json({ success: false, message: 'Server error starting lesson' });
	}
});

app.post('/api/camp/coach/live/goto', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const live = await readCampLiveLesson();
		if (!live.active) return res.status(400).json({ success: false, message: 'No lesson is live' });
		const index = Number(req.body.index);
		if (!Number.isInteger(index) || index < 0 || index >= live.slides.length) {
			return res.status(400).json({ success: false, message: 'Invalid slide index' });
		}
		live.currentIndex = index;
		await writeCampLiveLesson(live);
		return res.json({ success: true, live, tally: liveResponseTally(live) });
	} catch (err) {
		console.error('Camp live goto error:', err);
		return res.status(500).json({ success: false, message: 'Server error changing slide' });
	}
});

app.post('/api/camp/coach/live/stop', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const live = await readCampLiveLesson();
		live.active = false;
		live.activeQuestion = null;
		await writeCampLiveLesson(live);
		return res.json({ success: true, live: { active: false } });
	} catch (err) {
		console.error('Camp live stop error:', err);
		return res.status(500).json({ success: false, message: 'Server error stopping lesson' });
	}
});

// ── Live lessons: present the real HTML lesson decks, synced to camper iPads ──
const LIVE_QUIZ_POINT_LIMIT_MS = 20000; // answer within this window for full speed bonus

// Kahoot-style speed scaling: fast = 5 … slow = 1 (correct answers only).
function liveQuizPoints(elapsedMs) {
	const clamped = Math.min(Math.max(Number(elapsedMs) || 0, 0), LIVE_QUIZ_POINT_LIMIT_MS);
	return Math.max(1, Math.min(5, Math.round(5 - 4 * (clamped / LIVE_QUIZ_POINT_LIMIT_MS))));
}

// Score the currently-open question and write persistent point events for correct campers.
// Idempotent: guarded by scoredQuestionIds so re-closing never double-awards.
async function scoreLiveQuestion(live) {
	const aq = live.activeQuestion;
	if (!aq) return { results: {}, awarded: [] };
	if (live.scoredQuestionIds.includes(aq.id)) {
		const prior = live.lastClosed && live.lastClosed.questionId === aq.id ? live.lastClosed.results : {};
		return { results: prior, awarded: [] };
	}
	const qResponses = (live.responses && live.responses[aq.id]) || {};
	const startMs = aq.startedAt ? new Date(aq.startedAt).getTime() : Date.now();
	const results = {};
	const correctResponders = [];
	for (const [studentId, r] of Object.entries(qResponses)) {
		const correct = aq.correctIndex >= 0 && r && r.choice === aq.correctIndex;
		let points = 0;
		if (correct) {
			const atMs = r.at ? new Date(r.at).getTime() : startMs;
			points = liveQuizPoints(atMs - startMs);
			correctResponders.push({ studentId, points });
		}
		results[studentId] = { correct: !!correct, points, choice: Number.isInteger(r && r.choice) ? r.choice : null };
	}
	const awarded = [];
	if (correctResponders.length) {
		const users = await readCampUsers();
		const events = await readCampPointEvents();
		for (const cr of correctResponders) {
			const student = users.find((u) => u.id === cr.studentId && u.role === 'student');
			if (!student) continue;
			const event = {
				id: `point-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
				studentId: student.id,
				studentName: student.name,
				className: student.className || 'Unassigned',
				category: 'Live Quiz',
				icon: '⚡',
				type: 'positive',
				points: cr.points,
				note: `Correct: ${aq.title}`,
				createdBy: 'live-lesson',
				createdByName: 'Live Quiz',
				createdAt: new Date().toISOString()
			};
			events.push(event);
			awarded.push(event);
		}
		await writeJsonFile(campPointEventsFile, events);
	}
	live.scoredQuestionIds.push(aq.id);
	live.lastClosed = { questionId: aq.id, correctIndex: aq.correctIndex, results };
	return { results, awarded };
}

// Start a live HTML-deck presentation. Links the lesson's question bank by deckUrl.
app.post('/api/camp/coach/live/start-deck', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const deckUrl = cleanMetaString(req.body.deckUrl || '', 1000);
		if (!deckUrl || !deckUrl.startsWith('/camp-hub/lessons/')) {
			return res.status(400).json({ success: false, message: 'A lesson deck URL is required' });
		}
		const slideCount = Number.isInteger(Number(req.body.slideCount)) ? Math.max(0, Number(req.body.slideCount)) : 0;
		const lessons = await readCampLessons();
		const lesson = lessons.find((l) => l.deckUrl === deckUrl);
		const deckTitle = cleanMetaString(req.body.deckTitle || '', 200) || (lesson ? lesson.title : '');
		const live = normalizeCampLiveLesson({
			active: true,
			kind: 'deck',
			deckUrl,
			deckTitle,
			lessonId: lesson ? lesson.id : '',
			lessonTitle: lesson ? lesson.title : deckTitle,
			slideIndex: 0,
			slideCount,
			startedAt: new Date().toISOString(),
			responses: {},
			activeQuestion: null,
			scoredQuestionIds: [],
			lastClosed: null
		});
		await writeCampLiveLesson(live);
		const questions = lesson ? lesson.slides.filter((s) => s.type === 'question' && s.correctIndex >= 0)
			.map((s) => ({ id: s.id, title: s.title, body: s.body, options: s.options })) : [];
		return res.json({ success: true, live, tally: liveResponseTally(live), questions });
	} catch (err) {
		console.error('Camp live start-deck error:', err);
		return res.status(500).json({ success: false, message: 'Server error starting presentation' });
	}
});

// Move the live deck to a slide index (campers follow).
app.post('/api/camp/coach/live/slide', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const live = await readCampLiveLesson();
		if (!live.active || live.kind !== 'deck') return res.status(400).json({ success: false, message: 'No deck is live' });
		const index = Number(req.body.index);
		if (!Number.isInteger(index) || index < 0) return res.status(400).json({ success: false, message: 'Invalid slide index' });
		if (Number.isInteger(Number(req.body.slideCount))) live.slideCount = Math.max(live.slideCount, Math.max(0, Number(req.body.slideCount)));
		live.slideIndex = index;
		await writeCampLiveLesson(live);
		return res.json({ success: true, live });
	} catch (err) {
		console.error('Camp live slide error:', err);
		return res.status(500).json({ success: false, message: 'Server error changing slide' });
	}
});

// Push a multiple-choice question (Kahoot style) to the campers.
app.post('/api/camp/coach/live/push-question', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const live = await readCampLiveLesson();
		if (!live.active || live.kind !== 'deck') return res.status(400).json({ success: false, message: 'No deck is live' });
		const questionId = cleanMetaString(req.body.questionId || '', 120);
		const lessons = await readCampLessons();
		const lesson = lessons.find((l) => l.deckUrl === live.deckUrl) || lessons.find((l) => l.id === live.lessonId);
		const bankQ = lesson ? lesson.slides.find((s) => s.type === 'question' && s.id === questionId) : null;
		if (!bankQ) return res.status(404).json({ success: false, message: 'Question not found in this lesson' });
		const instanceId = `${bankQ.id}::${Date.now().toString(36)}`;
		const aq = normalizeLiveQuestion({ ...bankQ, id: instanceId, startedAt: new Date().toISOString() });
		if (!aq || aq.correctIndex < 0) return res.status(400).json({ success: false, message: 'This question has no correct answer set' });
		live.activeQuestion = aq;
		if (!live.responses) live.responses = {};
		live.responses[aq.id] = {};
		await writeCampLiveLesson(live);
		return res.json({ success: true, live, tally: liveResponseTally(live) });
	} catch (err) {
		console.error('Camp live push-question error:', err);
		return res.status(500).json({ success: false, message: 'Server error pushing question' });
	}
});

// Close the open question: score it (write point events) and reveal the answer.
app.post('/api/camp/coach/live/close-question', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const live = await readCampLiveLesson();
		if (!live.active || live.kind !== 'deck') return res.status(400).json({ success: false, message: 'No deck is live' });
		if (!live.activeQuestion) return res.json({ success: true, live, tally: { total: 0, counts: [] }, awarded: [] });
		const correctIndex = live.activeQuestion.correctIndex;
		const { awarded } = await scoreLiveQuestion(live);
		live.activeQuestion = null;
		await writeCampLiveLesson(live);
		return res.json({ success: true, live, tally: { total: 0, counts: [] }, awarded, correctIndex });
	} catch (err) {
		console.error('Camp live close-question error:', err);
		return res.status(500).json({ success: false, message: 'Server error closing question' });
	}
});

// ── Live lessons: camper viewing + answering (any signed-in camp user) ──
app.get('/api/camp/live', requireCampAuth, async (req, res) => {
	try {
		const live = await readCampLiveLesson();
		return res.json({ success: true, state: publicLiveStateForStudent(live, req.campUser.id) });
	} catch (err) {
		console.error('Camp live state error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading live lesson' });
	}
});

app.post('/api/camp/live/answer', requireCampAuth, async (req, res) => {
	try {
		const live = await readCampLiveLesson();

		// Deck mode: answer the currently-pushed Kahoot question (first answer locks).
		if (live.active && live.kind === 'deck') {
			const aq = live.activeQuestion;
			const questionId = cleanMetaString(req.body.questionId || '', 120);
			if (!aq || aq.id !== questionId) {
				return res.status(400).json({ success: false, message: 'That question is not open' });
			}
			const choice = Number(req.body.choice);
			if (!Number.isInteger(choice) || choice < 0 || choice >= aq.options.length) {
				return res.status(400).json({ success: false, message: 'Invalid choice' });
			}
			if (!live.responses[aq.id]) live.responses[aq.id] = {};
			const existing = live.responses[aq.id][req.campUser.id];
			if (existing && Number.isInteger(existing.choice)) {
				return res.json({ success: true, myAnswer: existing.choice, locked: true });
			}
			live.responses[aq.id][req.campUser.id] = { choice, name: req.campUser.name, at: new Date().toISOString() };
			await writeCampLiveLesson(live);
			return res.json({ success: true, myAnswer: choice });
		}

		if (!live.active || !live.slides.length) return res.status(400).json({ success: false, message: 'No lesson is live' });
		const slideId = cleanMetaString(req.body.slideId || '', 120);
		const current = live.slides[live.currentIndex];
		if (!current || current.id !== slideId || current.type !== 'question') {
			return res.status(400).json({ success: false, message: 'That question is not open' });
		}
		const choice = Number(req.body.choice);
		if (!Number.isInteger(choice) || choice < 0 || choice >= current.options.length) {
			return res.status(400).json({ success: false, message: 'Invalid choice' });
		}
		if (!live.responses[slideId]) live.responses[slideId] = {};
		live.responses[slideId][req.campUser.id] = { choice, name: req.campUser.name, at: new Date().toISOString() };
		await writeCampLiveLesson(live);
		return res.json({ success: true, myAnswer: choice });
	} catch (err) {
		console.error('Camp live answer error:', err);
		return res.status(500).json({ success: false, message: 'Server error submitting answer' });
	}
});

app.get('/api/camp/coach/roster', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const users = await readCampUsers();
		return res.json({
			success: true,
			users: users.filter((user) => user.demoAccount !== true).map((user) => ({
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
		const [users, curriculum, submissions, printRequests, projectSubmissions, pointEvents, masterRoster] = await Promise.all([
			readCampUsers(),
			readJsonFile(campCurriculumFile, []),
			readCampSubmissions(),
			readCampPrintRequests(),
			readCampProjectSubmissions(),
			readCampPointEvents(),
			readMasterRoster()
		]);
		const summerClasses = (masterRoster.classes || [])
			.filter((item) => item.term === 'summer' && item.active !== false)
			.map((item) => ({
				id: item.id,
				name: item.name,
				program: item.program || '',
				day: item.day || '',
				schedule: item.schedule || ''
			}));
		const students = users
			.filter((user) => user.role === 'student')
			.map((user) => ({
				id: user.id,
				name: user.name,
				username: user.username,
				active: user.active !== false,
				className: user.className || 'Unassigned',
				points: campPointsFor(user.id, submissions, printRequests, pointEvents, projectSubmissions)
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
		return res.json({ success: true, students, days, submissions, printRequests, projectSubmissions, pointEvents, summerClasses });
	} catch (err) {
		console.error('Camp coach progress error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading progress' });
	}
});

app.get('/api/camp/coach/projects', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const projects = await readCampProjectSubmissions();
		return res.json({ success: true, projects });
	} catch (err) {
		console.error('Camp coach project queue error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading projects' });
	}
});

app.patch('/api/camp/coach/projects/:id', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const projects = await readCampProjectSubmissions();
		const project = projects.find((item) => item.id === req.params.id);
		if (!project) {
			return res.status(404).json({ success: false, message: 'Project submission not found' });
		}
		const statuses = new Set(['submitted', 'reviewing', 'approved', 'featured', 'needs-revision']);
		const status = cleanMetaString(req.body.status || '', 40);
		if (status && statuses.has(status)) project.status = status;
		if (typeof req.body.coachFeedback === 'string') project.coachFeedback = cleanMetaString(req.body.coachFeedback, 1000);
		if (req.body.pointsAwarded !== undefined) {
			const points = Number(req.body.pointsAwarded);
			project.pointsAwarded = Number.isFinite(points) ? Math.max(0, Math.min(100, Math.round(points))) : 0;
		}
		project.updatedAt = new Date().toISOString();
		await writeJsonFile(campProjectSubmissionsFile, projects);
		return res.json({ success: true, project, projects });
	} catch (err) {
		console.error('Camp coach project update error:', err);
		return res.status(500).json({ success: false, message: 'Server error updating project' });
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
		const icon = cleanMetaString(req.body.icon || '', 8);
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
			icon,
			type,
			points,
			note,
			createdBy: req.campUser.id,
			createdByName: req.campUser.name,
			createdAt: new Date().toISOString()
		};
		events.push(event);
		await writeJsonFile(campPointEventsFile, events);
		const [submissions, printRequests, projectSubmissions] = await Promise.all([readCampSubmissions(), readCampPrintRequests(), readCampProjectSubmissions()]);
		return res.status(201).json({
			success: true,
			event,
			points: campPointsFor(student.id, submissions, printRequests, events, projectSubmissions),
			pointEvents: events
		});
	} catch (err) {
		console.error('Camp coach point event error:', err);
		return res.status(500).json({ success: false, message: 'Server error saving points' });
	}
});

app.post('/api/camp/coach/points/reset', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const className = cleanMetaString(req.body.className || '', 120);
		if (!className) {
			return res.status(400).json({ success: false, message: 'Class name is required to reset points' });
		}
		const events = await readCampPointEvents();
		const remaining = events.filter((event) => String(event.className || 'Unassigned') !== className);
		const removed = events.length - remaining.length;
		await writeJsonFile(campPointEventsFile, remaining);
		return res.json({
			success: true,
			removed,
			pointEvents: remaining,
			resetClassName: className
		});
	} catch (err) {
		console.error('Camp coach points reset error:', err);
		return res.status(500).json({ success: false, message: 'Server error resetting points' });
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

app.use('/api', (req, res) => {
	return res.status(404).json({
		success: false,
		message: 'API endpoint not found. Redeploy the latest site version if this feature was just added.'
	});
});

function encodePathForUrl(filePath) {
	return String(filePath || '')
		.split('/')
		.filter(Boolean)
		.map((part) => encodeURIComponent(part))
		.join('/');
}

app.use((req, res, next) => {
	const requestPath = decodeURIComponent(req.path || '');
	const fllStaticRoot = '/robotics lab/FLL Teams/2026-2027-bioglow';
	const campStaticRoot = '/robotics lab/Summer Camp/2026-summer-camp';
	if (requestPath === '/Lesson Building' || requestPath.startsWith('/Lesson Building/')) {
		return requireCampAuth(req, res, () => {
			if (req.campUser.role !== 'coach') return res.status(403).send('Coach access required');
			const suffix = requestPath.slice('/Lesson Building'.length).replace(/^\/+/, '') || 'index.html';
			return res.redirect(302, `/camp-hub/lessons/${encodePathForUrl(suffix)}`);
		});
	}
	if (requestPath === `${campStaticRoot}/lessons` || requestPath.startsWith(`${campStaticRoot}/lessons/`)) {
		return requireCampAuth(req, res, () => {
			if (req.campUser.role !== 'coach') return res.status(403).send('Coach access required');
			const suffix = requestPath.slice(`${campStaticRoot}/lessons`.length).replace(/^\/+/, '') || 'index.html';
			return res.redirect(302, `/camp-hub/lessons/${encodePathForUrl(suffix)}`);
		});
	}
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
	.then(() => migrateSummer2026RosterData())
	.then(() => ensureSummerDemoStudent())
	.then(() => ensureStudentPortalUsernames())
	.then(() => logDataHealthReport())
	.then(() => {
		app.listen(PORT, () => console.log(`AI Future Platform running at http://localhost:${PORT}`));
	})
	.catch((err) => {
		console.error('Failed to initialize hub data:', err);
		process.exit(1);
	});
