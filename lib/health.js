'use strict';
/**
 * GET /healthz — public, no session. Used by Render's healthCheckPath.
 * 200 {ok:true,checks:{...}} when the data dir is writable and the key JSON
 * files parse; 503 {ok:false,failed:[...]} otherwise. Only check names and
 * short reasons are returned — never file contents, paths or secrets.
 */
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function createHealthHandler({ dataDir, fllDataDir, cacheMs = 5000 } = {}) {
	if (!dataDir) throw new Error('createHealthHandler: dataDir is required');
	fllDataDir = fllDataDir || path.join(dataDir, 'fll-hub', '2026-2027-bioglow', 'data');
	const jsonChecks = {
		'master-roster': path.join(dataDir, 'master-roster.json'),
		'coach-users': path.join(dataDir, 'coach-users.json'),
		'fll-tasks': path.join(fllDataDir, 'tasks.json'),
		'fll-teams': path.join(fllDataDir, 'teams.json'),
		'fll-users': path.join(fllDataDir, 'fll-users.json')
	};
	let cached = null;
	let cachedAt = 0;
	let inFlight = null;

	async function runChecks() {
		const checks = {};
		try {
			const probe = path.join(dataDir, `.healthz-${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`);
			await fsp.writeFile(probe, 'ok');
			await fsp.unlink(probe);
			checks['data-dir-writable'] = 'ok';
		} catch (err) {
			checks['data-dir-writable'] = `failed (${err.code || 'error'})`;
		}
		await Promise.all(Object.entries(jsonChecks).map(async ([name, file]) => {
			try {
				JSON.parse(await fsp.readFile(file, 'utf8'));
				checks[name] = 'ok';
			} catch (err) {
				checks[name] = err.code === 'ENOENT' ? 'failed (missing)' : err instanceof SyntaxError ? 'failed (invalid JSON)' : `failed (${err.code || 'error'})`;
			}
		}));
		const failed = Object.keys(checks).filter((k) => checks[k] !== 'ok');
		return { status: failed.length ? 503 : 200, body: failed.length ? { ok: false, failed, checks } : { ok: true, checks } };
	}

	return async function healthHandler(req, res) {
		try {
			if (!cached || Date.now() - cachedAt > cacheMs) {
				inFlight = inFlight || runChecks().finally(() => { inFlight = null; });
				cached = await inFlight;
				cachedAt = Date.now();
			}
			res.setHeader('Cache-Control', 'no-store');
			res.status(cached.status).json(cached.body);
		} catch (err) {
			res.status(503).json({ ok: false, failed: ['health-check-error'] });
		}
	};
}

module.exports = { createHealthHandler };
