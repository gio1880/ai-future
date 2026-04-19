# Code Lab

The Code Lab is the interactive Python learning platform embedded in the AI Future website. It is served under the `/codelab` path by the main Express server (`server.js` at the project root).

## Local Development

From the project root:

```bash
npm install
node server.js
```

Then visit:

- Main site: <http://localhost:3000>
- Code Lab app: <http://localhost:3000/codelab/app>
- Admin panel: <http://localhost:3000/admin>

Default accounts (created on first boot when data files are empty):

- Teacher — username `teacher` / password `pylearn2026`
- Developer — username `developer` / password `devreview2026`

## Environment Variables

Set these in your Render dashboard (or a local `.env` file for development). See `.env.example` at the project root.

- `NODE_ENV` — `production` on Render, omit or `development` locally
- `PORT` — port the server listens on (Render sets this automatically; locally defaults to `3000`)
- `SESSION_SECRET` — long random string used to sign session cookies. On Render, use `generateValue: true` (see `render.yaml`) so Render generates a secure random value once
- `DATA_DIR` — absolute path to the persistent data directory. On Render this must point to the mounted disk (e.g., `/var/data`). If unset, the server falls back to `code-lab/data/` for local development
- `ANTHROPIC_API_KEY` — *optional*. Enables the AI Tutor side panel (🤖 button on lesson pages). The tutor is prompt-engineered to give Socratic hints and never reveal full solutions. Without this key, the tutor still works but returns built-in diagnostic hints. Keep this secret — never commit it
- `ANTHROPIC_TUTOR_MODEL` — *optional*. Override the model used for the tutor (defaults to `claude-haiku-4-5-20251001`)

## Data Persistence on Render

Student accounts, progress, tickets, and activity are stored as JSON files in `DATA_DIR`. On Render, `DATA_DIR` should be mounted on a persistent Render Disk so data survives deploys and restarts. See `render.yaml` at the project root for the full service + disk configuration.

On first boot with an empty disk, `initializeDataFiles()` seeds:

- `students.json` — teacher + developer accounts only
- `progress.json` — `{}`
- `tickets.json` — `[]`
- `activity.json` — `[]`

Subsequent deploys leave the disk untouched, so students never lose progress.

## Feature Notes

**Auto-save drafts.** Student code in the Exercise and Lab textareas auto-saves to `localStorage` (keyed by lesson) with a 400ms debounce. Drafts restore automatically on re-open — refresh-proof and accidental-close-proof.

**Priority Review.** When a student misses questions on a unit test, the lessons associated with those questions (`reviewLessons` field on each question) are flagged in their progress under `_priorityReview`. A red banner appears at the top of lesson grids listing the flagged lessons sorted by severity. Passing each lesson's quiz again auto-clears its flag.

**Mini-Project (py-02b).** First creative build — Mad Libs — slotted between py-02 and py-03. Uses loose `contains`-based validation so students can be creative. Prerequisite is py-02; does **not** block py-03, so existing students are not retroactively locked out.

**Final Project.** Capstone at `#/final-project`. Unlocks only after the student passes the Python unit test **and** has no remaining priority-review flags. Provides a 3-tier brief (baseline/stretch/open), starter code for a text adventure, a self-check rubric (requires ≥4 of 7 boxes to submit), and a "Submit to Teacher" action that marks `final-project-python` completed in progress. Teachers can see submissions via `/admin` (progress list) or via `/api/admin/backup`.

**Live Classroom.** Teachers see `/admin` → Live Classroom panel with each student's status (online / stuck / offline) and current lesson. Powered by in-memory presence (15s heartbeat from students). Presence resets on server restart — that's intentional, it's ephemeral state.

**Backup.** Teachers can download a full JSON backup of students/progress/tickets/activity from the admin panel (or `GET /api/admin/backup`). Use this before a risky deploy or for end-of-term archiving.

**AI Tutor.** Optional 🤖 side panel on lesson & final-project pages. Calls `POST /api/tutor/chat` which forwards context (lesson, code, error) to the Anthropic API with a strict Socratic system prompt. Without `ANTHROPIC_API_KEY`, the endpoint returns built-in diagnostic hints based on the error message.
