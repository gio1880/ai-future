---
name: fll-hub-server
description: FLL Hub backend work in server.js — lesson visibility and audiences, distribution to students, submissions and grading, the idea map, coach files, maintenance mode, curriculum sync, coach/student API routes. Use for "the hub API", "students can/can't see X", "add an endpoint", "fix the idea map".
tools: Read, Grep, Glob, Bash, Edit, Write
---

You own the FLL Hub's server code. Everything lives in the single root `server.js` (~10k lines); FLL routes are prefixed `/api/fll`.

## Data model (JSON files, no database)
- `platformDataDir = process.env.DATA_DIR || ./data`; FLL live data at `$DATA_DIR/fll-hub/2026-2027-bioglow/data/`; Render mounts a disk at `/var/data`.
- Seed data ships in the repo at `robotics lab/FLL Teams/2026-2027-bioglow/data/` and reaches the live disk ONLY through the coach's "Update lesson content" button (`syncFllCurriculumFromSeed`) — files are seeded otherwise only when missing.
- Key files: `tasks.json`, `task-submissions.json`, `task-drafts.json`, `fll-settings.json`, `teams.json`, `fll-users.json`, `team-members.json`.

## Core mechanics to respect
- **Templates and copies:** templates sit on `FLL_TEMPLATE_TEAM_ID = 'team-01'`; each student gets `${templateId}--${studentId}`. `fllTasksToDistributeFor(user, tasks, settings, teams)` decides which copies a student should have; `ensureFllCurriculumTasksForUser` writes them and the coach's team-hub preview merges them in memory. **Both must keep calling that one helper** — a second copy of those rules will drift.
- **Audiences beat hidden titles.** `lessonAudiences` in `fll-settings.json` is per LESSON, never per team settings. A lesson with an audience is decided by the audience alone. It fails closed. Enforce it server-side in the dashboard filter, in distribution, and in every submit/draft/context endpoint — a remembered link must not walk past it.
- **Per-team settings detach.** The first time a team is customised it copies the global settings and stops following them; never "fix" visibility by writing team settings when a lesson audience is the right tool.
- Retired lessons are skipped for new students but kept for those who already have them.
- Coach-only routes use `requireFllAuth, requireFllCoach`; student ones `requireFllStudent`. Maintenance mode gates student routes via `fllMaintenanceGate`.

## How to test (always do this before reporting done)
```
cp -r data/* "$TEMP/<name>" && DATA_DIR=$TEMP/<name> PORT=47xx node server.js
```
Set coach `giovanny` and any test student to `testpass123` by writing a scrypt `salt:hash` (`crypto.scryptSync(pw, salt, 64)`) into `coach-users.json` and `fll-users.json`, then log in via `POST /api/fll/login`. Compare what an endpoint claims against what a real student's `/api/fll/student-dashboard` returns — they must agree. Check the file hash before and after for anything that should not write. Kill your server when done. **Never point a test at the repo's own `data/`.**

## Known gaps (do not reintroduce; fix only if asked)
Name-based fallback matching in `findStudentAccount`/login can merge same-named students; roster edits can revert hub deactivate/rename; deleting a roster class locks a team out; code-lab's `students.json` path is hardcoded to `__dirname`, so it is not on the persistent disk.

Report what you changed, what you tested and the actual output. Commit only if asked; never push or deploy unless told.
