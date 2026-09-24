'use strict';
/**
 * Backups of the data disk.
 *
 * Each backup is ONE standard .tar.gz file (ustar + PAX long names), written
 * with Node built-ins only. It opens with any tar tool, e.g.
 *     tar -xzf backup-20260923T031500Z.tar.gz        (Windows 10+, macOS, Linux)
 * Files are streamed one 1 MB chunk at a time through gzip, so a large uploads
 * folder never has to fit in memory.
 *
 * Left out: the backup folder itself, the top-level `sessions/` folder (login
 * tokens should not travel inside downloadable archives) and in-flight `*.tmp`
 * files from temp-file-then-rename writes.
 *
 * IMPORTANT: by default backups live on the SAME disk as the data
 * ($DATA_DIR/backups). They protect against bad writes, bugs and mistakes, not
 * against losing the disk. The owner-only download is the off-disk copy.
 *
 * Restoring is deliberately NOT exposed over HTTP — see scripts/restore-backup.js.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const zlib = require('zlib');

const BACKUP_NAME_RE = /^backup-\d{8}T\d{6}Z\.tar\.gz$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const CHUNK = 1024 * 1024;
const EXCLUDED_TOP_LEVEL = new Set(['sessions']);

function timestampName(date = new Date()) {
	const iso = date.toISOString(); // 2026-09-23T03:15:00.123Z
	return `backup-${iso.slice(0, 19).replace(/[-:]/g, '')}Z.tar.gz`;
}

// ── tar writing ──────────────────────────────────────────────────────────────
function writeOctal(buf, value, offset, length) {
	const str = Math.floor(value).toString(8).padStart(length - 1, '0');
	buf.write(str.slice(-(length - 1)), offset, length - 1, 'ascii');
	buf[offset + length - 1] = 0;
}

function tarHeader({ name, size, mode, mtime, type }) {
	const h = Buffer.alloc(512, 0);
	h.write(name, 0, 100, 'utf8');
	writeOctal(h, mode & 0o7777, 100, 8);
	writeOctal(h, 0, 108, 8);
	writeOctal(h, 0, 116, 8);
	writeOctal(h, size, 124, 12);
	writeOctal(h, mtime, 136, 12);
	h.fill(0x20, 148, 156); // checksum placeholder = spaces
	h.write(type, 156, 1, 'ascii');
	h.write('ustar', 257, 5, 'ascii'); // byte 262 stays 0
	h.write('00', 263, 2, 'ascii');
	let sum = 0;
	for (let i = 0; i < 512; i++) sum += h[i];
	h.write(sum.toString(8).padStart(6, '0'), 148, 6, 'ascii');
	h[154] = 0;
	h[155] = 0x20;
	return h;
}

function paxRecord(key, value) {
	const body = ` ${key}=${value}\n`;
	const bodyLen = Buffer.byteLength(body);
	let len = bodyLen + 1;
	while (String(len).length + bodyLen !== len) len = String(len).length + bodyLen;
	return Buffer.from(`${len}${body}`, 'utf8');
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

function headersFor(entry) {
	// names that are long or non-ASCII get a PAX 'path' record before the header
	if (Buffer.byteLength(entry.name) <= 99 && PRINTABLE_ASCII.test(entry.name)) return [tarHeader(entry)];
	const pax = paxRecord('path', entry.name);
	return [
		tarHeader({ name: 'PaxHeader', size: pax.length, mode: 0o644, mtime: entry.mtime, type: 'x' }),
		pax,
		Buffer.alloc((512 - (pax.length % 512)) % 512, 0),
		tarHeader({ ...entry, name: entry.name.replace(/[^\x20-\x7e]/g, '_').slice(0, 99) })
	];
}

// ── collecting files ─────────────────────────────────────────────────────────
async function collectEntries(dataDir, backupDir) {
	const root = path.resolve(dataDir);
	const skipDir = path.resolve(backupDir);
	const out = [];
	async function walk(dir) {
		let items;
		try { items = await fsp.readdir(dir, { withFileTypes: true }); } catch (err) {
			if (err.code === 'ENOENT') return;
			throw err;
		}
		items.sort((a, b) => a.name.localeCompare(b.name));
		for (const item of items) {
			const abs = path.join(dir, item.name);
			const rel = path.relative(root, abs).split(path.sep).join('/');
			if (item.isSymbolicLink()) continue;
			if (item.isDirectory()) {
				if (path.resolve(abs) === skipDir) continue;
				if (dir === root && EXCLUDED_TOP_LEVEL.has(item.name)) continue;
				out.push({ type: 'dir', rel, abs });
				await walk(abs);
			} else if (item.isFile()) {
				if (item.name.endsWith('.tmp') || item.name.endsWith('.partial')) continue;
				out.push({ type: 'file', rel, abs });
			}
		}
	}
	await walk(root);
	return out;
}

function waitDrain(stream) {
	return new Promise((resolve, reject) => {
		const onDrain = () => { cleanup(); resolve(); };
		const onError = (err) => { cleanup(); reject(err); };
		const cleanup = () => { stream.off('drain', onDrain); stream.off('error', onError); };
		stream.on('drain', onDrain);
		stream.on('error', onError);
	});
}

async function push(gzip, buf) {
	if (!gzip.write(buf)) await waitDrain(gzip);
}

async function appendFile(gzip, entry) {
	let fh;
	try { fh = await fsp.open(entry.abs, 'r'); } catch (err) {
		if (err.code === 'ENOENT') return false; // deleted since the walk
		throw err;
	}
	try {
		const st = await fh.stat();
		const size = st.size;
		for (const h of headersFor({ name: entry.rel, size, mode: st.mode, mtime: st.mtimeMs / 1000, type: '0' })) await push(gzip, h);
		let done = 0;
		while (done < size) {
			const buf = Buffer.alloc(Math.min(CHUNK, size - done));
			const { bytesRead } = await fh.read(buf, 0, buf.length, done);
			if (bytesRead === 0) { // file shrank mid-read: pad so the archive stays valid
				await push(gzip, Buffer.alloc(size - done, 0));
				break;
			}
			await push(gzip, bytesRead === buf.length ? buf : buf.subarray(0, bytesRead));
			done += bytesRead;
		}
		const pad = (512 - (size % 512)) % 512;
		if (pad) await push(gzip, Buffer.alloc(pad, 0));
		return size;
	} finally {
		await fh.close();
	}
}

/**
 * Make one compressed archive of dataDir (minus backupDir and sessions/), then
 * delete the oldest backups so only `keep` remain.
 * Resolves to { name, path, bytes, files }.
 */
async function createBackup({ dataDir, backupDir, keep = 7, now = new Date() } = {}) {
	if (!dataDir) throw new Error('createBackup: dataDir is required');
	backupDir = backupDir || path.join(dataDir, 'backups');
	await fsp.mkdir(backupDir, { recursive: true });
	const entries = await collectEntries(dataDir, backupDir);

	// Don't fill the disk: a full disk would break every save in the app.
	let rawBytes = 0;
	for (const e of entries) {
		if (e.type === 'file') { try { rawBytes += (await fsp.stat(e.abs)).size; } catch { /* gone */ } }
	}
	if (typeof fsp.statfs === 'function') {
		let free = Infinity;
		try { const s = await fsp.statfs(backupDir); free = Number(s.bavail) * Number(s.bsize); } catch { /* unknown */ }
		const needed = rawBytes + 50 * 1024 * 1024; // worst case: no compression, plus headroom
		if (free < needed) throw new Error(`not enough free disk space for a backup (free ${free} bytes, need about ${needed})`);
	}

	let name = timestampName(now);
	if (fs.existsSync(path.join(backupDir, name))) name = timestampName(new Date(now.getTime() + 1000));
	const finalPath = path.join(backupDir, name);
	const partPath = `${finalPath}.partial`;

	const gzip = zlib.createGzip({ level: 6 });
	const out = fs.createWriteStream(partPath, { mode: 0o600 });
	const finished = new Promise((resolve, reject) => {
		out.on('finish', resolve);
		out.on('error', reject);
		gzip.on('error', reject);
	});
	finished.catch(() => {}); // handled below
	gzip.pipe(out);
	let files = 0;
	try {
		for (const e of entries) {
			if (e.type === 'dir') {
				for (const h of headersFor({ name: `${e.rel}/`, size: 0, mode: 0o755, mtime: Date.now() / 1000, type: '5' })) await push(gzip, h);
			} else if ((await appendFile(gzip, e)) !== false) {
				files += 1;
			}
		}
		await push(gzip, Buffer.alloc(1024, 0)); // end-of-archive marker
		gzip.end();
		await finished;
		await fsp.rename(partPath, finalPath);
	} catch (err) {
		gzip.destroy();
		out.destroy();
		await fsp.rm(partPath, { force: true }).catch(() => {});
		throw err;
	}

	await pruneBackups(backupDir, keep);
	const bytes = (await fsp.stat(finalPath)).size;
	return { name, path: finalPath, bytes, files };
}

async function pruneBackups(backupDir, keep) {
	const list = await listBackups(backupDir); // newest first
	for (const b of list.slice(Math.max(1, keep))) await fsp.rm(path.join(backupDir, b.name), { force: true });
	for (const n of await fsp.readdir(backupDir).catch(() => [])) { // leftovers from a crash mid-backup
		if (n.endsWith('.partial')) await fsp.rm(path.join(backupDir, n), { force: true }).catch(() => {});
	}
}

/** Newest first: [{ name, bytes, createdAt }] */
async function listBackups(backupDir) {
	let names;
	try { names = await fsp.readdir(backupDir); } catch (err) {
		if (err.code === 'ENOENT') return [];
		throw err;
	}
	const out = [];
	for (const name of names.filter((n) => BACKUP_NAME_RE.test(n))) {
		try {
			const st = await fsp.stat(path.join(backupDir, name));
			if (!st.isFile()) continue;
			const m = name.match(/^backup-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
			out.push({ name, bytes: st.size, createdAt: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` });
		} catch { /* removed meanwhile */ }
	}
	return out.sort((a, b) => (a.name < b.name ? 1 : -1));
}

/**
 * Stream one backup to an HTTP response. `name` is only used to find an entry
 * in listBackups() — it is never joined into a path itself.
 * Resolves true when sent, false when there is no backup by that name.
 */
async function sendBackup(res, backupDir, name) {
	const match = (await listBackups(backupDir)).find((b) => b.name === String(name || ''));
	if (!match) return false;
	const filePath = path.join(backupDir, match.name);
	res.setHeader('Content-Type', 'application/gzip');
	res.setHeader('Content-Length', String(match.bytes));
	res.setHeader('Content-Disposition', `attachment; filename="${match.name}"`);
	res.setHeader('Cache-Control', 'no-store');
	res.setHeader('X-Content-Type-Options', 'nosniff');
	await new Promise((resolve) => {
		const stream = fs.createReadStream(filePath);
		stream.on('error', (err) => {
			console.error('Backup download failed:', err.message);
			if (!res.headersSent) { res.statusCode = 500; res.end(); } else res.destroy(err);
			resolve();
		});
		res.on('close', () => { stream.destroy(); resolve(); });
		stream.pipe(res);
	});
	return true;
}

/**
 * First run shortly after boot if there is no backup from the last 24h, then
 * every 24h. Never throws into the server; failures are logged.
 * Returns { stop(), runNow() }.
 */
function scheduleDailyBackups({ dataDir, backupDir, keep = 7, initialDelayMs = 2 * 60 * 1000, intervalMs = DAY_MS, logger = console } = {}) {
	backupDir = backupDir || path.join(dataDir, 'backups');
	let timer = null;
	let running = false;
	let stopped = false;

	const arm = (delay) => {
		if (stopped) return;
		clearTimeout(timer);
		timer = setTimeout(tick, Math.max(1000, delay));
		timer.unref?.();
	};

	async function runNow() {
		if (running) return null;
		running = true;
		try {
			const started = Date.now();
			const result = await createBackup({ dataDir, backupDir, keep });
			logger.log(`Backup written: ${result.name} (${result.files} files, ${result.bytes} bytes, ${Date.now() - started} ms)`);
			return result;
		} catch (err) {
			logger.error('Backup failed:', err && err.message ? err.message : err);
			return null;
		} finally {
			running = false;
		}
	}

	async function tick() {
		try {
			const newest = (await listBackups(backupDir))[0];
			const age = newest ? Date.now() - Date.parse(newest.createdAt) : Infinity;
			if (age < intervalMs) return arm(intervalMs - age);
			await runNow();
		} catch (err) {
			logger.error('Backup scheduler error:', err && err.message ? err.message : err);
		}
		arm(intervalMs);
	}

	arm(initialDelayMs);
	return { stop() { stopped = true; clearTimeout(timer); }, runNow };
}

// ── restore ──────────────────────────────────────────────────────────────────
function readString(buf, offset, length) {
	const slice = buf.subarray(offset, offset + length);
	const end = slice.indexOf(0);
	return slice.subarray(0, end === -1 ? slice.length : end).toString('utf8');
}

function parsePax(buf) {
	const out = {};
	let i = 0;
	while (i < buf.length) {
		const sp = buf.indexOf(0x20, i);
		if (sp === -1) break;
		const len = parseInt(buf.subarray(i, sp).toString('ascii'), 10);
		if (!len) break;
		const rec = buf.subarray(sp + 1, i + len - 1).toString('utf8');
		const eq = rec.indexOf('=');
		if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1);
		i += len;
	}
	return out;
}

function safeTarget(root, name) {
	const clean = String(name).replace(/\\/g, '/');
	if (!clean || clean.startsWith('/') || /^[a-zA-Z]:/.test(clean) || clean.split('/').includes('..')) {
		throw new Error(`Refusing unsafe path in archive: ${name}`);
	}
	const abs = path.resolve(root, clean);
	if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`Refusing path outside target: ${name}`);
	return abs;
}

/**
 * Restore a backup archive into targetDir (created if needed).
 * Files at the same path in targetDir are overwritten; nothing else is deleted.
 * Rejects absolute paths and `..` in the archive. Verifies each header checksum
 * and fails on a truncated archive.
 * For scripts/restore-backup.js only — never expose this over HTTP.
 * Resolves to { files, dirs }.
 */
async function restoreBackup(archivePath, targetDir) {
	const root = path.resolve(targetDir);
	await fsp.mkdir(root, { recursive: true });
	const stream = fs.createReadStream(archivePath).pipe(zlib.createGunzip());

	let buf = Buffer.alloc(0);
	let state = 'header';
	let remaining = 0;
	let padding = 0;
	let current = null; // { kind: 'file'|'pax'|'skip', fd, abs, mtime, chunks }
	let paxPath = null;
	let files = 0;
	let dirs = 0;
	let ended = false;

	const finishEntry = () => {
		if (current.kind === 'file') {
			fs.closeSync(current.fd);
			if (current.mtime) fs.utimesSync(current.abs, current.mtime, current.mtime);
			files += 1;
		} else if (current.kind === 'pax') {
			const pax = parsePax(Buffer.concat(current.chunks));
			if (pax.path) paxPath = pax.path;
		}
		current = null;
		state = padding ? 'pad' : 'header';
	};

	try {
		for await (const chunk of stream) {
			if (ended) continue;
			buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
			while (buf.length && !ended) {
				if (state === 'header') {
					if (buf.length < 512) break;
					const h = buf.subarray(0, 512);
					buf = buf.subarray(512);
					if (h.every((b) => b === 0)) { ended = true; break; }
					let sum = 0;
					for (let i = 0; i < 512; i++) sum += (i >= 148 && i < 156) ? 0x20 : h[i];
					if (sum !== parseInt(readString(h, 148, 8).trim(), 8)) throw new Error('Archive is corrupt (bad header checksum)');
					const type = h[156] ? String.fromCharCode(h[156]) : '0';
					const size = parseInt(readString(h, 124, 12).trim() || '0', 8);
					const mtime = parseInt(readString(h, 136, 12).trim() || '0', 8);
					const prefix = readString(h, 345, 155);
					let name = paxPath || (prefix ? `${prefix}/${readString(h, 0, 100)}` : readString(h, 0, 100));
					if (type !== 'x') paxPath = null;
					remaining = size;
					padding = (512 - (size % 512)) % 512;
					if (type === 'x') {
						current = { kind: 'pax', chunks: [] };
					} else if (type === '5') {
						name = name.replace(/\/+$/, '');
						if (name) { fs.mkdirSync(safeTarget(root, name), { recursive: true }); dirs += 1; }
						current = { kind: 'skip' };
					} else if (type === '0') {
						const abs = safeTarget(root, name);
						fs.mkdirSync(path.dirname(abs), { recursive: true });
						current = { kind: 'file', abs, fd: fs.openSync(abs, 'w', 0o600), mtime };
					} else {
						current = { kind: 'skip' }; // links etc. are never written by createBackup
					}
					state = 'data';
					if (remaining === 0) finishEntry();
				} else if (state === 'data') {
					const n = Math.min(remaining, buf.length);
					const part = buf.subarray(0, n);
					if (current.kind === 'file') fs.writeSync(current.fd, part);
					else if (current.kind === 'pax') current.chunks.push(Buffer.from(part));
					buf = buf.subarray(n);
					remaining -= n;
					if (remaining === 0) finishEntry();
				} else { // pad
					const n = Math.min(padding, buf.length);
					buf = buf.subarray(n);
					padding -= n;
					if (padding === 0) state = 'header';
				}
			}
		}
	} finally {
		if (current && current.kind === 'file') { try { fs.closeSync(current.fd); } catch { /* already closed */ } }
	}
	if (!ended) throw new Error('Archive ended early (truncated backup?)');
	return { files, dirs };
}

module.exports = { createBackup, scheduleDailyBackups, listBackups, sendBackup, restoreBackup, BACKUP_NAME_RE };
