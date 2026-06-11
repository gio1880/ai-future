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
const campSessionCookie = 'camp_session';
const campDataFileNames = [
	'camp-users.json',
	'camp.json',
	'curriculum.json',
	'announcements.json',
	'resources.json'
];
const campSessions = new Map();

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
		role: user.role
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

async function getCampHubDataFor(user) {
	const [camp, curriculum, announcements, resources] = await Promise.all([
		readJsonFile(path.join(campHubDataDir, 'camp.json'), {}),
		readJsonFile(campCurriculumFile, []),
		readJsonFile(campAnnouncementsFile, []),
		readJsonFile(path.join(campHubDataDir, 'resources.json'), [])
	]);
	const isCoach = user.role === 'coach';
	const visibleAnnouncements = (Array.isArray(announcements) ? announcements : [])
		.filter((item) => item.audience === 'all' || item.audience === user.role);
	const visibleResources = (Array.isArray(resources) ? resources : [])
		.filter((item) => !Array.isArray(item.roles) || item.roles.includes(user.role));
	const visibleCurriculum = (Array.isArray(curriculum) ? curriculum : []).map((week) => ({
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
		resources: visibleResources
	};
}

async function getFllHubDataFor(user) {
	const [season, teams, timeline, announcements, resources, tasks, assignments, sections] = await Promise.all([
		readJsonFile(path.join(fllHubDataDir, 'season.json'), {}),
		readJsonFile(path.join(fllHubDataDir, 'teams.json'), []),
		readJsonFile(path.join(fllHubDataDir, 'timeline.json'), []),
		readJsonFile(path.join(fllHubDataDir, 'announcements.json'), []),
		readJsonFile(path.join(fllHubDataDir, 'resources.json'), []),
		readJsonFile(fllTasksFile, []),
		readJsonFile(fllAssignmentsFile, []),
		readJsonFile(fllSeasonSectionsFile, [])
	]);

	const teamList = Array.isArray(teams) ? teams : [];
	const visibleTeams = user.role === 'coach' ? teamList : teamList.filter((team) => team.id === user.teamId);
	return {
		user: publicFllUser(user),
		season,
		teams: visibleTeams,
		allTeams: user.role === 'coach' ? teamList : undefined,
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
				active: user.active !== false
			}))
		});
	} catch (err) {
		console.error('Camp coach roster error:', err);
		return res.status(500).json({ success: false, message: 'Server error loading roster' });
	}
});

app.post('/api/camp/coach/students', requireCampAuth, requireCampCoach, async (req, res) => {
	try {
		const name = cleanMetaString(req.body.name || '', 80);
		if (!name) {
			return res.status(400).json({ success: false, message: 'Camper name is required' });
		}
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
			active: true
		});
		await writeJsonFile(campUsersFile, users);
		return res.status(201).json({ success: true, student: { id, name, username: finalUsername, password: finalPassword } });
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
		await writeJsonFile(campUsersFile, users);
		const response = { success: true, user: { id: user.id, name: user.name, username: user.username, active: user.active !== false } };
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

Promise.all([initializeFllDataDir(), initializeCampDataDir()])
	.then(() => {
		app.listen(PORT, () => console.log(`AI Future Platform running at http://localhost:${PORT}`));
	})
	.catch((err) => {
		console.error('Failed to initialize hub data:', err);
		process.exit(1);
	});
