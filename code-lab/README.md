# Code Lab

Forked and customized Pybricks lesson platform, integrated into the AI Future website.

## Environment Variables

Set these in your Render dashboard (never commit real values):

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` on Render |
| `SESSION_SECRET` | Yes | Long random string for session encryption |
| `DATA_DIR` | Yes | Render Disk mount path (e.g. `/var/data`) |

## Default Logins

| Role | Username | Password |
|------|----------|----------|
| Teacher / Admin | `teacher` | `pylearn2026` |
| Developer | `developer` | `devreview2026` |

These are created automatically on first boot if no data files exist.

## Data Persistence on Render

Student accounts and progress are stored as JSON files in `DATA_DIR`.

1. Create a **Render Disk** mounted at `/var/data`
2. Set `DATA_DIR=/var/data` in your Render environment variables
3. When you push code updates, the disk (and all student data) is untouched

See `render.yaml` at the project root for the full deployment configuration.
