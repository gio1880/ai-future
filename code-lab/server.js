/**
 * PyLearn Student Platform Backend Server
 * Express.js server with session-based auth, REST API, and JSON file storage
 */

const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Simple password hashing using Node.js built-in crypto (no external dependencies)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === testHash;
}

// ============================================
// CREDENTIAL GENERATION HELPERS
// ============================================

/**
 * Generate username from first and last name
 * e.g., "Maria Garcia" -> "mgarcia", duplicate -> "mgarcia42"
 */
function generateUsername(firstName, lastName, existingUsernames) {
  const base = (firstName[0] + lastName).toLowerCase().replace(/[^a-z]/g, '');
  if (!existingUsernames.includes(base)) return base;

  // Add random digits until unique
  let attempts = 0;
  while (attempts < 100) {
    const suffix = Math.floor(Math.random() * 90 + 10); // 10-99
    const candidate = base + suffix;
    if (!existingUsernames.includes(candidate)) return candidate;
    attempts++;
  }

  return base + Date.now().toString().slice(-4);
}

/**
 * Generate kid-friendly password
 * e.g., "blue472", "star831"
 */
function generatePassword() {
  const words = ['blue', 'star', 'moon', 'fish', 'tree', 'bird', 'frog', 'bear', 'lion', 'wolf',
                 'sun', 'leaf', 'rock', 'fire', 'snow', 'rain', 'wind', 'bolt', 'wave', 'paw',
                 'fox', 'owl', 'bee', 'ant', 'cat', 'dog', 'bat', 'elk', 'ram', 'yak'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 900 + 100); // 100-999
  return word + num;
}

// ============================================
// CONFIGURATION
// ============================================

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'pylearn-dev-secret-key-change-in-prod';

// Data directory and file paths
// DATA_DIR env var points to a Render Disk (persistent storage) in production.
// Falls back to local ./data folder for development.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');

// Write lock for preventing race conditions
let writeLocks = {};

// ============================================
// LIVE-CLASSROOM PRESENCE (in-memory, ephemeral)
// Tracks per-student last ping, current lesson, and whether they've flagged
// themselves as stuck. Resets on server restart — that's intentional; it's
// only "who is actively in the app right now."
// ============================================
const presence = new Map(); // studentId -> { name, username, lastPing, currentLessonId, currentStep, stuckSince }
const ONLINE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes without a heartbeat = offline

function touchPresence(student, patch) {
  const prev = presence.get(student.id) || {};
  presence.set(student.id, {
    name: student.name,
    username: student.username,
    lastPing: Date.now(),
    ...prev,
    ...patch,
    name: student.name,       // ensure latest name wins
    username: student.username
  });
}

function clearStuck(studentId) {
  const prev = presence.get(studentId);
  if (prev && prev.stuckSince) {
    presence.set(studentId, { ...prev, stuckSince: null });
  }
}

// ============================================
// INITIALIZATION & HELPERS
// ============================================

/**
 * Ensure data directory and files exist
 */
function initializeDataFiles() {
  // Create data directory if it doesn't exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Initialize students.json with default teacher and developer
  if (!fs.existsSync(STUDENTS_FILE)) {
    const defaultTeacher = {
      id: 'teacher-default',
      name: 'Teacher',
      username: 'teacher',
      password_hash: hashPassword('pylearn2026'),
      role: 'teacher',
      created_at: new Date().toISOString()
    };

    const defaultDeveloper = {
      id: 'developer-default',
      name: 'Developer',
      username: 'developer',
      password_hash: hashPassword('devreview2026'),
      role: 'developer',
      created_at: new Date().toISOString()
    };

    fs.writeFileSync(STUDENTS_FILE, JSON.stringify([defaultTeacher, defaultDeveloper], null, 2));
    console.log('\n✓ Created default teacher account');
    console.log('  Default teacher account: username=teacher, password=pylearn2026');
    console.log('  Default developer account: username=developer, password=devreview2026\n');
  }

  // Initialize progress.json as empty object
  if (!fs.existsSync(PROGRESS_FILE)) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({}, null, 2));
  }

  // Initialize tickets.json as empty array
  if (!fs.existsSync(TICKETS_FILE)) {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify([], null, 2));
  }

  // Initialize activity.json as empty array
  if (!fs.existsSync(ACTIVITY_FILE)) {
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Simple file-based lock mechanism to prevent race conditions
 */
async function acquireLock(fileKey, timeout = 5000) {
  const startTime = Date.now();
  while (writeLocks[fileKey]) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Lock acquisition timeout');
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  writeLocks[fileKey] = true;
}

function releaseLock(fileKey) {
  delete writeLocks[fileKey];
}

/**
 * Read students from JSON file
 */
function readStudents() {
  try {
    const data = fs.readFileSync(STUDENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading students file:', err);
    return [];
  }
}

/**
 * Write students to JSON file
 */
async function writeStudents(students) {
  await acquireLock('students');
  try {
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(students, null, 2));
  } finally {
    releaseLock('students');
  }
}

/**
 * Read progress from JSON file
 */
function readProgress() {
  try {
    const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading progress file:', err);
    return {};
  }
}

/**
 * Write progress to JSON file
 */
async function writeProgress(progress) {
  await acquireLock('progress');
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } finally {
    releaseLock('progress');
  }
}

/**
 * Read activity log from JSON file
 */
function readActivity() {
  try {
    const data = fs.readFileSync(ACTIVITY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading activity file:', err);
    return [];
  }
}

/**
 * Write activity log to JSON file
 */
async function writeActivity(activity) {
  await acquireLock('activity');
  try {
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(activity, null, 2));
  } finally {
    releaseLock('activity');
  }
}

/**
 * Log an activity event (keeps most recent 200 events)
 */
async function logActivity(type, studentName, studentUsername, details) {
  const activity = readActivity();
  activity.unshift({
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
    type,
    studentName,
    studentUsername,
    details,
    timestamp: new Date().toISOString()
  });
  // Keep only the most recent 200 events
  if (activity.length > 200) activity.length = 200;
  await writeActivity(activity);
}

/**
 * Generate unique ID
 */
function generateId() {
  return 'student-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Find student by username
 */
function findStudentByUsername(username) {
  const students = readStudents();
  return students.find(s => s.username === username);
}

/**
 * Find student by ID
 */
function findStudentById(id) {
  const students = readStudents();
  return students.find(s => s.id === id);
}

/**
 * Get student progress or create default
 */
function getOrCreateProgress(studentId) {
  const progress = readProgress();
  if (!progress[studentId]) {
    progress[studentId] = {
      lessonProgress: {},
      lastLogin: new Date().toISOString(),
      totalTime: 0
    };
  }
  return progress[studentId];
}

// ============================================
// MIDDLEWARE
// ============================================

// Trust reverse proxy (required for Render, Heroku, etc. so secure cookies work)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.static(__dirname));

// Serve FLL assessment assets (SVG diagrams)
app.use('/fll-assets', express.static(path.join(__dirname, 'progressive fll test', 'assets')));

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

/**
 * Middleware: Require authentication
 */
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  next();
}

/**
 * Middleware: Require teacher role
 */
function requireTeacher(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'teacher') {
    return res.status(403).json({ success: false, error: 'Teacher access required' });
  }
  next();
}

/**
 * Middleware: Require developer role
 */
function requireDeveloper(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'developer') {
    return res.status(403).json({ success: false, error: 'Developer access required' });
  }
  next();
}

// ============================================
// AUTH API ENDPOINTS
// ============================================

/**
 * POST /api/login
 * Login a user with username and password
 */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.json({ success: false, error: 'Username and password required' });
    }

    const student = findStudentByUsername(username);
    if (!student) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    const passwordMatch = verifyPassword(password, student.password_hash);
    if (!passwordMatch) {
      return res.json({ success: false, error: 'Invalid credentials' });
    }

    // Store in session
    req.session.user = {
      id: student.id,
      name: student.name,
      username: student.username,
      role: student.role
    };

    // Update last login in progress (only for students)
    if (student.role === 'student') {
      const progress = readProgress();
      const studentProgress = getOrCreateProgress(student.id);
      studentProgress.lastLogin = new Date().toISOString();
      progress[student.id] = studentProgress;
      await writeProgress(progress);

      // Log activity
      logActivity('login', student.name, student.username, 'Logged in').catch(err => console.error('Activity log error:', err));

      // Seed presence so the classroom dashboard shows them immediately
      touchPresence(student, { stuckSince: null });
    }

    res.json({
      success: true,
      user: req.session.user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/logout
 * Logout the current user
 */
app.post('/api/logout', (req, res) => {
  // Drop presence so the classroom view marks them offline right away
  if (req.session && req.session.user && req.session.user.id) {
    presence.delete(req.session.user.id);
  }
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

/**
 * GET /api/me
 * Get current logged-in user info
 */
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.session.user });
});

// ============================================
// LIVE-CLASSROOM API ENDPOINTS
// ============================================

/**
 * POST /api/heartbeat
 * Student pings this every ~15s while the app is open so the teacher's
 * live-classroom dashboard can show who is actively working and on which lesson.
 * In-memory only — cheap, no disk writes.
 */
app.post('/api/heartbeat', requireAuth, (req, res) => {
  if (req.session.user.role !== 'student') {
    return res.json({ success: true, stuck: false, ignored: true });
  }
  const { lessonId, currentStep } = req.body || {};
  touchPresence(req.session.user, {
    currentLessonId: typeof lessonId === 'string' ? lessonId : null,
    currentStep: typeof currentStep === 'string' ? currentStep : null
  });
  const p = presence.get(req.session.user.id);
  res.json({ success: true, stuck: !!(p && p.stuckSince) });
});

/**
 * POST /api/stuck
 * Student toggles the "I'm stuck" flag. Lights up on the teacher's dashboard.
 */
app.post('/api/stuck', requireAuth, (req, res) => {
  if (req.session.user.role !== 'student') {
    return res.json({ success: false, error: 'Only students can flag stuck' });
  }
  const on = !!(req.body && req.body.on);
  touchPresence(req.session.user, { stuckSince: on ? Date.now() : null });
  // Log stuck events so they also appear in the admin activity feed
  if (on) {
    logActivity('stuck', req.session.user.name, req.session.user.username,
      'Asked for help' + (req.body && req.body.lessonId ? ` on ${req.body.lessonId}` : ''))
      .catch(err => console.error('Activity log error:', err));
  }
  res.json({ success: true, stuck: on });
});

/**
 * GET /api/admin/classroom
 * Snapshot of who's online, what lesson they're on, and whether they're stuck.
 * Teacher-only. Polled by the admin UI every ~10 seconds.
 */
app.get('/api/admin/classroom', requireAuth, requireTeacher, (req, res) => {
  try {
    const now = Date.now();
    const students = readStudents().filter(s => s.role === 'student');
    const progress = readProgress();

    const roster = students.map(s => {
      const p = presence.get(s.id) || {};
      const prog = progress[s.id] || {};
      const lessonProgress = prog.lessonProgress || {};
      const lessonsCompleted = Object.values(lessonProgress).filter(x => x && x.completed).length;
      const online = p.lastPing && (now - p.lastPing) < ONLINE_WINDOW_MS;
      return {
        id: s.id,
        name: s.name,
        username: s.username,
        online: !!online,
        lastPing: p.lastPing ? new Date(p.lastPing).toISOString() : null,
        currentLessonId: p.currentLessonId || null,
        currentStep: p.currentStep || null,
        stuckSince: p.stuckSince ? new Date(p.stuckSince).toISOString() : null,
        lessonsCompleted,
        lastLogin: prog.lastLogin || null
      };
    });

    // Sort: stuck first, then online, then by last activity
    roster.sort((a, b) => {
      if (!!a.stuckSince !== !!b.stuckSince) return a.stuckSince ? -1 : 1;
      if (a.online !== b.online) return a.online ? -1 : 1;
      const at = a.lastPing ? Date.parse(a.lastPing) : 0;
      const bt = b.lastPing ? Date.parse(b.lastPing) : 0;
      return bt - at;
    });

    res.json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        online_count: roster.filter(r => r.online).length,
        stuck_count: roster.filter(r => r.stuckSince).length,
        roster
      }
    });
  } catch (err) {
    console.error('Classroom snapshot error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// STUDENT PROGRESS API ENDPOINTS
// ============================================

/**
 * GET /api/progress
 * Get the logged-in student's progress data
 * Developers get empty progress
 */
app.get('/api/progress', requireAuth, (req, res) => {
  try {
    // Allow both students and developers
    if (req.session.user.role === 'developer') {
      return res.json({ success: true, data: {} });
    }

    if (req.session.user.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Student access required' });
    }

    const progress = getOrCreateProgress(req.session.user.id);
    res.json({ success: true, data: progress });
  } catch (err) {
    console.error('Get progress error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/progress
 * Save/merge progress for logged-in student
 * Developers can call this but it does nothing
 */
app.post('/api/progress', requireAuth, async (req, res) => {
  try {
    // Allow both students and developers
    if (req.session.user.role === 'developer') {
      return res.json({ success: true, data: {} });
    }

    if (req.session.user.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Student access required' });
    }

    const { lessonProgress, totalTime, fllResults } = req.body;
    const progress = readProgress();
    const studentProgress = getOrCreateProgress(req.session.user.id);

    // Detect newly completed lessons for activity log
    if (lessonProgress) {
      const oldProgress = studentProgress.lessonProgress || {};
      for (const [lessonId, data] of Object.entries(lessonProgress)) {
        const wasCompleted = oldProgress[lessonId] && oldProgress[lessonId].completed;
        const nowCompleted = data && data.completed;
        if (nowCompleted && !wasCompleted) {
          logActivity('lesson_complete', req.session.user.name, req.session.user.username, `Completed ${lessonId}`)
            .catch(err => console.error('Activity log error:', err));
        }
        const wasQuizPassed = oldProgress[lessonId] && oldProgress[lessonId].quizPassed;
        const nowQuizPassed = data && data.quizPassed;
        if (nowQuizPassed && !wasQuizPassed) {
          logActivity('quiz_passed', req.session.user.name, req.session.user.username, `Passed quiz for ${lessonId}`)
            .catch(err => console.error('Activity log error:', err));
        }
      }
    }

    // Merge lesson progress
    if (lessonProgress) {
      studentProgress.lessonProgress = {
        ...studentProgress.lessonProgress,
        ...lessonProgress
      };
    }

    // Merge FLL assessment results
    if (fllResults) {
      if (!studentProgress.fllResults) {
        studentProgress.fllResults = [];
      }
      // fllResults can be a single result object or array
      const results = Array.isArray(fllResults) ? fllResults : [fllResults];
      for (const result of results) {
        // Check for duplicate sessionIds
        const existing = studentProgress.fllResults.findIndex(r => r.sessionId === result.sessionId);
        if (existing >= 0) {
          studentProgress.fllResults[existing] = result; // update
        } else {
          studentProgress.fllResults.push(result);
        }
      }
      // Keep only the most recent 20 FLL results
      if (studentProgress.fllResults.length > 20) {
        studentProgress.fllResults = studentProgress.fllResults.slice(-20);
      }
    }

    // Update total time if provided
    if (typeof totalTime === 'number') {
      studentProgress.totalTime = totalTime;
    }

    studentProgress.lastLogin = new Date().toISOString();
    progress[req.session.user.id] = studentProgress;
    await writeProgress(progress);

    res.json({ success: true, data: studentProgress });
  } catch (err) {
    console.error('Post progress error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * GET /api/leaderboard
 * Get anonymized class progress
 */
app.get('/api/leaderboard', requireAuth, (req, res) => {
  try {
    const students = readStudents();
    const progress = readProgress();

    // Build leaderboard with lesson completion counts (anonymized)
    const leaderboard = students
      .filter(s => s.role === 'student')
      .map(s => {
        const studentProgress = progress[s.id] || { lessonProgress: {}, totalTime: 0 };
        const lessonsCompleted = Object.keys(studentProgress.lessonProgress || {}).length;
        return {
          name: s.name,
          lessonsCompleted,
          totalTime: studentProgress.totalTime || 0
        };
      })
      .sort((a, b) => b.lessonsCompleted - a.lessonsCompleted);

    res.json({ success: true, data: leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// ADMIN API ENDPOINTS
// ============================================

/**
 * GET /api/admin/students
 * Get list of all students (no passwords)
 */
app.get('/api/admin/students', requireAuth, requireTeacher, (req, res) => {
  try {
    const students = readStudents();
    const progress = readProgress();

    // Return students without passwords
    const studentList = students
      .filter(s => s.role === 'student')
      .map(s => {
        const studentProgress = progress[s.id] || { lessonProgress: {}, lastLogin: null };
        const lessonsCompleted = Object.keys(studentProgress.lessonProgress || {}).length;
        return {
          id: s.id,
          name: s.name,
          username: s.username,
          created_at: s.created_at,
          lessonsCompleted,
          lastLogin: studentProgress.lastLogin
        };
      });

    res.json({ success: true, data: studentList });
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/admin/students
 * Create a new student with auto-generated credentials
 * Now accepts {firstName, lastName} instead of {name, username, password}
 */
app.post('/api/admin/students', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
      return res.json({ success: false, error: 'First name and last name required' });
    }

    const students = readStudents();
    const existingUsernames = students.map(s => s.username);

    // Auto-generate credentials
    const username = generateUsername(firstName, lastName, existingUsernames);
    const password = generatePassword();
    const name = `${firstName} ${lastName}`;

    const newStudent = {
      id: generateId(),
      name,
      username,
      password_hash: hashPassword(password),
      role: 'student',
      created_at: new Date().toISOString()
    };

    students.push(newStudent);
    await writeStudents(students);

    // Initialize progress for new student
    const progress = readProgress();
    progress[newStudent.id] = {
      lessonProgress: {},
      lastLogin: null,
      totalTime: 0
    };
    await writeProgress(progress);

    res.json({
      success: true,
      data: {
        id: newStudent.id,
        name: newStudent.name,
        username: newStudent.username,
        password: password, // Return plaintext password for display
        created_at: newStudent.created_at
      }
    });
  } catch (err) {
    console.error('Create student error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/admin/students/bulk
 * Create multiple students at once with auto-generated credentials
 * Accepts lines of "FirstName LastName" or "FirstName,LastName"
 */
app.post('/api/admin/students/bulk', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { students: newStudentLines } = req.body;

    if (!Array.isArray(newStudentLines) || newStudentLines.length === 0) {
      return res.json({ success: false, error: 'Students array required' });
    }

    const students = readStudents();
    const progress = readProgress();
    const created = [];
    const errors = [];

    for (let i = 0; i < newStudentLines.length; i++) {
      const line = newStudentLines[i];

      // Parse "FirstName LastName" or "FirstName,LastName"
      let firstName, lastName;
      if (line.includes(',')) {
        [firstName, lastName] = line.split(',').map(s => s.trim());
      } else {
        const parts = line.trim().split(/\s+/);
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }

      if (!firstName || !lastName) {
        errors.push({ index: i, error: 'First name and last name required' });
        continue;
      }

      const existingUsernames = students.map(s => s.username);
      const username = generateUsername(firstName, lastName, existingUsernames);
      const password = generatePassword();
      const name = `${firstName} ${lastName}`;

      const newStudent = {
        id: generateId(),
        name,
        username,
        password_hash: hashPassword(password),
        role: 'student',
        created_at: new Date().toISOString()
      };

      students.push(newStudent);
      progress[newStudent.id] = {
        lessonProgress: {},
        lastLogin: null,
        totalTime: 0
      };

      created.push({
        id: newStudent.id,
        name: newStudent.name,
        username: newStudent.username,
        password: password // Return plaintext password for display
      });
    }

    await writeStudents(students);
    await writeProgress(progress);

    res.json({
      success: errors.length === 0,
      data: { created, errors }
    });
  } catch (err) {
    console.error('Bulk create error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * DELETE /api/admin/students/:id
 * Remove a student
 */
app.delete('/api/admin/students/:id', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    const students = readStudents();
    const initialLength = students.length;
    const filtered = students.filter(s => s.id !== id);

    if (filtered.length === initialLength) {
      return res.json({ success: false, error: 'Student not found' });
    }

    await writeStudents(filtered);

    // Also remove from progress
    const progress = readProgress();
    delete progress[id];
    await writeProgress(progress);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/admin/students/:id/reset-password
 * Reset a student's password
 */
app.post('/api/admin/students/:id/reset-password', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.json({ success: false, error: 'Password required' });
    }

    const students = readStudents();
    const student = students.find(s => s.id === id);

    if (!student) {
      return res.json({ success: false, error: 'Student not found' });
    }

    student.password_hash = hashPassword(password);
    await writeStudents(students);

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * GET /api/admin/progress
 * Get all students' progress (teacher overview)
 */
app.get('/api/admin/progress', requireAuth, requireTeacher, (req, res) => {
  try {
    const students = readStudents();
    const progress = readProgress();

    const progressData = students
      .filter(s => s.role === 'student')
      .map(s => {
        const studentProgress = progress[s.id] || { lessonProgress: {}, lastLogin: null, totalTime: 0, fllResults: [] };
        return {
          id: s.id,
          name: s.name,
          username: s.username,
          lessonsCompleted: Object.keys(studentProgress.lessonProgress || {}).length,
          lastLogin: studentProgress.lastLogin,
          totalTime: studentProgress.totalTime || 0,
          lessonProgress: studentProgress.lessonProgress,
          fllResults: studentProgress.fllResults || []
        };
      });

    res.json({ success: true, data: progressData });
  } catch (err) {
    console.error('Get admin progress error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * POST /api/admin/reset-progress/:id
 * Reset a student's progress
 */
app.post('/api/admin/reset-progress/:id', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    const progress = readProgress();
    if (!progress[id]) {
      return res.json({ success: false, error: 'Student not found' });
    }

    progress[id] = {
      lessonProgress: {},
      fllResults: [],
      lastLogin: progress[id].lastLogin,
      totalTime: 0
    };

    await writeProgress(progress);
    res.json({ success: true });
  } catch (err) {
    console.error('Reset progress error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// ADMIN PANEL ROUTE
// ============================================
// TICKET / ISSUE REPORTING API
// ============================================

// Submit a ticket (any authenticated student or anonymous)
app.post('/api/tickets', async (req, res) => {
  try {
    const { type, description, page, student, userAgent } = req.body;

    if (!type || !description) {
      return res.status(400).json({ success: false, error: 'Type and description are required' });
    }

    await acquireLock('tickets');
    try {
      let tickets = [];
      if (fs.existsSync(TICKETS_FILE)) {
        tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
      }

      const ticket = {
        id: 'ticket-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        type: type,
        description: description.substring(0, 1000), // limit length
        page: page || 'unknown',
        student: student || (req.session && req.session.user ? req.session.user.username : 'anonymous'),
        userAgent: (userAgent || '').substring(0, 200),
        status: 'open',
        created_at: new Date().toISOString()
      };

      tickets.push(ticket);
      fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
      releaseLock('tickets');

      res.json({ success: true, ticketId: ticket.id });
    } catch (err) {
      releaseLock('tickets');
      throw err;
    }
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ success: false, error: 'Failed to create ticket' });
  }
});

// Get all tickets (teacher only)
app.get('/api/admin/tickets', requireAuth, requireTeacher, (req, res) => {
  try {
    let tickets = [];
    if (fs.existsSync(TICKETS_FILE)) {
      tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
    }
    // Return newest first
    tickets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, data: tickets });
  } catch (error) {
    console.error('Error reading tickets:', error);
    res.status(500).json({ success: false, error: 'Failed to read tickets' });
  }
});

// Update ticket status (teacher only)
app.post('/api/admin/tickets/:id/status', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    await acquireLock('tickets');
    try {
      let tickets = [];
      if (fs.existsSync(TICKETS_FILE)) {
        tickets = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
      }

      const ticket = tickets.find(t => t.id === req.params.id);
      if (!ticket) {
        releaseLock('tickets');
        return res.status(404).json({ success: false, error: 'Ticket not found' });
      }

      ticket.status = status;
      ticket.updated_at = new Date().toISOString();
      fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
      releaseLock('tickets');

      res.json({ success: true });
    } catch (err) {
      releaseLock('tickets');
      throw err;
    }
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ success: false, error: 'Failed to update ticket' });
  }
});

// ============================================

/**
 * GET /api/admin/activity
 * Get recent activity feed (teacher only)
 */
app.get('/api/admin/activity', requireAuth, requireTeacher, (req, res) => {
  try {
    const activity = readActivity();
    const limit = parseInt(req.query.limit) || 50;
    res.json({ success: true, data: activity.slice(0, limit) });
  } catch (err) {
    console.error('Get activity error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * GET /api/admin/backup
 * One-click backup of all four JSON data files. Teacher-only.
 * Returns a single JSON blob with timestamp + file contents, served as a download.
 * This is the insurance policy against the Render Disk getting wiped.
 */
app.get('/api/admin/backup', requireAuth, requireTeacher, (req, res) => {
  try {
    const safeRead = (filePath) => {
      try {
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        return { _error: 'Failed to parse ' + path.basename(filePath), message: e.message };
      }
    };

    const payload = {
      meta: {
        exported_at: new Date().toISOString(),
        exported_by: req.session.user.username,
        data_dir: DATA_DIR,
        app: 'code-lab',
        version: 1
      },
      students: safeRead(STUDENTS_FILE),
      progress: safeRead(PROGRESS_FILE),
      tickets: safeRead(TICKETS_FILE),
      activity: safeRead(ACTIVITY_FILE)
    };

    // Filename like code-lab-backup-2026-04-19T14-22-05.json (safe for Windows too)
    const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
    const filename = `code-lab-backup-${stamp}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ success: false, error: 'Backup failed' });
  }
});

// ============================================
// AI TUTOR (Socratic, never hands out full solutions)
// POST /api/tutor/chat  {lessonId, lessonTitle, studentCode, errorMessage, question, history}
// Requires ANTHROPIC_API_KEY env var. If not set, returns a structured hint
// response so the UI can still show something useful.
// ============================================
const TUTOR_SYSTEM_PROMPT = [
  "You are Code Lab's friendly AI tutor for students in grades 5-8 learning Python.",
  "",
  "RULES (follow strictly):",
  "- NEVER give the full answer or a complete working code block for the current exercise.",
  "- Nudge with one small question or one specific hint at a time.",
  "- If the student shares code, point at ONE thing to try next — not a full rewrite.",
  "- If they ask you to \"just tell me the answer\" or \"give me the code\", kindly decline and explain you're here to help them figure it out.",
  "- Use plain language. Short paragraphs. A concrete analogy when it helps.",
  "- If they're stuck on syntax, you may show a tiny 1-2 line snippet that illustrates the concept — but NOT the solution to their exercise.",
  "- If they seem frustrated, acknowledge it warmly before the hint.",
  "- Keep each reply under about 120 words.",
  "- If the student asks for help OUTSIDE programming (homework in another subject, personal topics, etc.), gently steer back to the lesson.",
  "",
  "You know the student's current lesson and (if they share it) their current code and any error message. Use that context."
].join('\n');

function tutorFallback(payload) {
  // Offline / no-key fallback — still useful
  const { errorMessage, studentCode } = payload || {};
  const hints = [];
  if (errorMessage) {
    hints.push("Your error says: **" + String(errorMessage).slice(0, 160) + "**");
    if (/SyntaxError|invalid syntax/i.test(errorMessage)) {
      hints.push("Syntax errors usually mean a missing colon `:`, quote `\"`, or parenthesis `)`. Re-read the line right before the error arrow.");
    } else if (/NameError/.test(errorMessage)) {
      hints.push("A NameError means Python doesn't recognize that word. Did you spell a variable the same both times? Did you create it before using it?");
    } else if (/IndentationError/.test(errorMessage)) {
      hints.push("Indentation matters in Python. Lines inside `if` or `while` or `for` need the same number of spaces at the start.");
    } else if (/TypeError/.test(errorMessage)) {
      hints.push("A TypeError often means you mixed types (like adding a number to a string). Try `print(type(your_variable))` to check.");
    }
  } else if (studentCode) {
    hints.push("Read your code out loud, line by line. Say exactly what each line is telling the computer to do. The bug usually shows up when the words don't match your intent.");
  } else {
    hints.push("Try writing what you want the program to do in plain English first. Then turn each English sentence into one line of code.");
  }
  hints.push("_(AI tutor is offline right now — these are built-in hints. Your teacher can enable the AI tutor by setting ANTHROPIC_API_KEY.)_");
  return hints.join('\n\n');
}

app.post('/api/tutor/chat', requireAuth, async (req, res) => {
  try {
    const { lessonId, lessonTitle, studentCode, errorMessage, question, history } = req.body || {};
    const userQuestion = (question || '').toString().slice(0, 1200);
    const safeCode = (studentCode || '').toString().slice(0, 4000);
    const safeError = (errorMessage || '').toString().slice(0, 800);
    const safeTitle = (lessonTitle || lessonId || '').toString().slice(0, 120);

    if (!userQuestion.trim()) {
      return res.status(400).json({ success: false, error: 'Please type a question for the tutor.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.json({
        success: true,
        offline: true,
        reply: tutorFallback({ errorMessage: safeError, studentCode: safeCode }),
      });
    }

    // Build the user-turn content combining context + the student question
    const contextBlock = [
      safeTitle ? `CURRENT LESSON: ${safeTitle}` : null,
      safeCode ? `STUDENT'S CURRENT CODE:\n\`\`\`python\n${safeCode}\n\`\`\`` : null,
      safeError ? `ERROR MESSAGE:\n\`\`\`\n${safeError}\n\`\`\`` : null,
      `STUDENT QUESTION: ${userQuestion}`,
    ].filter(Boolean).join('\n\n');

    // Build messages with limited prior history (last 6 turns max)
    const priorMessages = Array.isArray(history) ? history.slice(-6) : [];
    const messages = [];
    priorMessages.forEach(turn => {
      if (!turn || !turn.role || !turn.content) return;
      if (turn.role !== 'user' && turn.role !== 'assistant') return;
      messages.push({ role: turn.role, content: String(turn.content).slice(0, 2000) });
    });
    messages.push({ role: 'user', content: contextBlock });

    const body = {
      model: process.env.ANTHROPIC_TUTOR_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: TUTOR_SYSTEM_PROMPT,
      messages,
    };

    // Node 18+ has global fetch
    const anth = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!anth.ok) {
      const errText = await anth.text().catch(() => '');
      console.error('Tutor API error:', anth.status, errText.slice(0, 400));
      // Graceful fallback so the student still gets *something* helpful
      return res.json({
        success: true,
        offline: true,
        reply: tutorFallback({ errorMessage: safeError, studentCode: safeCode }),
      });
    }
    const data = await anth.json();
    const reply = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
               || 'I\'m not sure what to say. Can you rephrase your question?';
    res.json({ success: true, offline: false, reply });
  } catch (err) {
    console.error('Tutor endpoint error:', err);
    res.status(500).json({ success: false, error: 'Tutor is temporarily unavailable.' });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Admin HTML is served from admin.html file
// (removed inline template — see admin.html)


// ============================================
// STATIC FILE SERVING
// ============================================

// Serve index.html as fallback for root routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// HIDDEN DEVELOPMENT PLATFORM (not linked from public site)
// Access at /dev — requires teacher auth
// ============================================
app.use('/dev', requireAuth, requireTeacher, express.static(path.join(__dirname, '_platform')));
app.get('/dev', requireAuth, requireTeacher, (req, res) => {
  res.sendFile(path.join(__dirname, '_platform', 'index.html'));
});
app.get('/dev/*', requireAuth, requireTeacher, (req, res) => {
  res.sendFile(path.join(__dirname, '_platform', 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ============================================
// SERVER STARTUP
// ============================================

initializeDataFiles();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n✓ PyLearn Server running at http://localhost:${PORT}`);
    console.log(`  Admin panel: http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
