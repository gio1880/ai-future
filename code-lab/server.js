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

app.listen(PORT, () => {
  console.log(`\n✓ PyLearn Server running at http://localhost:${PORT}`);
  console.log(`  Admin panel: http://localhost:${PORT}/admin\n`);
});
