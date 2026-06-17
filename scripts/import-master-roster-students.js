const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rosterPath = path.join(root, 'data', 'master-roster.json');
const codeLabStudentsPath = path.join(root, 'code-lab', 'data', 'students.json');
const fllUsersPath = path.join(root, 'data', 'fll-hub', '2026-2027-bioglow', 'data', 'fll-users.json');
const fllTeamsPath = path.join(root, 'data', 'fll-hub', '2026-2027-bioglow', 'data', 'teams.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function cleanId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function upsertClass(roster, classItem) {
  const index = roster.classes.findIndex((candidate) => candidate.id === classItem.id);
  if (index === -1) {
    roster.classes.push(classItem);
    return;
  }
  roster.classes[index] = {
    ...roster.classes[index],
    ...classItem,
    createdAt: roster.classes[index].createdAt || classItem.createdAt
  };
}

function upsertStudent(roster, existingByName, source, classId, sourceLabel, sourceId, now) {
  const name = String(source.name || '').trim();
  const key = name.toLowerCase();
  if (!key) return;

  const noteParts = [
    `Imported from ${sourceLabel}${source.username ? ` account (${source.username})` : ''}`
  ];
  if (source.teamId) noteParts.push(`FLL team: ${source.teamId}`);
  noteParts.push(`Source id: ${sourceId || source.id || ''}`);

  const incoming = {
    id: `master-${cleanId(sourceLabel)}-${cleanId(source.username || source.id || key)}`,
    name,
    parentName: '',
    email: '',
    phone: '',
    notes: `${noteParts.join('; ')}.`,
    active: source.active !== false,
    enrollments: [{ classId, weeks: [] }],
    createdAt: now,
    updatedAt: now
  };

  if (!existingByName.has(key)) {
    existingByName.set(key, roster.students.length);
    roster.students.push(incoming);
    return;
  }

  const index = existingByName.get(key);
  const current = roster.students[index];
  const enrollments = Array.isArray(current.enrollments) ? current.enrollments.slice() : [];
  if (!enrollments.some((item) => item.classId === classId)) {
    enrollments.push({ classId, weeks: [] });
  }

  roster.students[index] = {
    ...current,
    name: current.name || incoming.name,
    notes: current.notes || incoming.notes,
    active: current.active !== false,
    enrollments,
    updatedAt: now
  };
}

function main() {
  const now = new Date().toISOString();
  const roster = readJson(rosterPath);
  const codeLabStudents = readJson(codeLabStudentsPath).filter((student) => student.role === 'student');
  const fllStudents = readJson(fllUsersPath).filter((user) => user.role === 'student');
  const fllTeams = readJson(fllTeamsPath);

  roster.classes = Array.isArray(roster.classes) ? roster.classes : [];
  roster.students = Array.isArray(roster.students) ? roster.students : [];

  upsertClass(roster, {
    id: 'code-lab-students',
    term: 'year-round',
    program: 'code-lab',
    name: 'Code Lab Students',
    day: 'Online / lab',
    schedule: 'Imported from Code Lab accounts',
    active: true,
    createdAt: now
  });

  for (const team of fllTeams) {
    upsertClass(roster, {
      id: `fll-${team.id}`,
      term: 'fall',
      program: 'fll',
      name: `FLL - ${team.nickname || team.name || team.id}`,
      day: team.meetingDays || 'Team schedule',
      schedule: team.meetingTime || team.currentFocus || 'Imported from FLL hub team roster',
      active: true,
      createdAt: now
    });
  }

  const existingByName = new Map(
    roster.students.map((student, index) => [String(student.name || '').trim().toLowerCase(), index])
  );

  for (const student of codeLabStudents) {
    upsertStudent(roster, existingByName, student, 'code-lab-students', 'Code Lab', student.id, now);
  }

  for (const student of fllStudents) {
    upsertStudent(roster, existingByName, student, `fll-${student.teamId}`, 'FLL Hub', student.id, now);
  }

  roster.updatedAt = now;
  fs.writeFileSync(rosterPath, `${JSON.stringify(roster, null, 2)}\n`);

  console.log(JSON.stringify({
    students: roster.students.length,
    classes: roster.classes.length,
    importedCodeLab: codeLabStudents.length,
    importedFll: fllStudents.length
  }, null, 2));
}

main();
