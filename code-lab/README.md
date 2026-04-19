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

## Data Persistence on Render

Student accounts, progress, tickets, and activity are stored as JSON files in `DATA_DIR`. On Render, `DATA_DIR` should be mounted on a persistent Render Disk so data survives deploys and restarts. See `render.yaml` at the project root for the full service + disk configuration.

On first boot with an empty disk, `initializeDataFiles()` seeds:

- `students.json` — teacher + developer accounts only
- `progress.json` — `{}`
- `tickets.json` — `[]`
- `activity.json` — `[]`

Subsequent deploys leave the disk untouched, so students never lose progress.
