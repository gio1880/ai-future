'use strict';
/**
 * A small file-backed store for express-session (no extra dependency), so
 * Code Lab sign-ins survive a restart or deploy.
 *
 * - Session ids are stored as SHA-256 hashes, so the file cannot be used to log in.
 * - Writes are debounced and go temp-file-then-rename, so a crash never leaves
 *   half a file. Sign-in/sign-out are written within ~1s; touches within ~60s.
 * - Expired entries are dropped on load, on read and on each save.
 * - Call flush() on shutdown (SIGTERM) to write anything pending.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function createFileSessionStore(session) {
	const Store = session.Store;

	class FileSessionStore extends Store {
		constructor({ file, defaultTtlMs = 24 * 60 * 60 * 1000 } = {}) {
			super();
			if (!file) throw new Error('FileSessionStore: file is required');
			this.file = file;
			this.defaultTtlMs = defaultTtlMs;
			this.sessions = new Map(); // hash -> { expires, data }
			this.timer = null;
			this.timerDue = 0;
			this.load();
		}

		static hash(sid) {
			return crypto.createHash('sha256').update(String(sid)).digest('hex');
		}

		expiryOf(sess) {
			const exp = sess && sess.cookie && sess.cookie.expires;
			const t = exp ? new Date(exp).getTime() : NaN;
			return Number.isFinite(t) ? t : Date.now() + this.defaultTtlMs;
		}

		load() {
			try {
				const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
				const now = Date.now();
				for (const [key, entry] of Object.entries(saved || {})) {
					if (entry && entry.expires > now && entry.data) this.sessions.set(key, entry);
				}
			} catch (err) {
				if (err.code !== 'ENOENT') console.error(`Could not read ${this.file}; starting with no saved Code Lab sessions:`, err.message);
			}
		}

		schedule(delay) {
			const due = Date.now() + delay;
			if (this.timer && this.timerDue <= due) return;
			clearTimeout(this.timer);
			this.timerDue = due;
			this.timer = setTimeout(() => this.flush(), delay);
			this.timer.unref?.();
		}

		flush() {
			clearTimeout(this.timer);
			this.timer = null;
			try {
				const now = Date.now();
				for (const [k, v] of this.sessions) if (v.expires <= now) this.sessions.delete(k);
				fs.mkdirSync(path.dirname(this.file), { recursive: true });
				const tmp = `${this.file}.tmp`;
				fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.sessions)), { mode: 0o600 });
				fs.renameSync(tmp, this.file);
			} catch (err) {
				console.error(`Could not save Code Lab sessions to ${this.file}:`, err.message);
			}
		}

		get(sid, cb) {
			const key = FileSessionStore.hash(sid);
			const entry = this.sessions.get(key);
			if (!entry) return cb(null, null);
			if (entry.expires <= Date.now()) {
				this.sessions.delete(key);
				this.schedule(60 * 1000);
				return cb(null, null);
			}
			let data;
			try { data = JSON.parse(entry.data); } catch (err) { return cb(err); }
			return cb(null, data);
		}

		set(sid, sess, cb) {
			try {
				this.sessions.set(FileSessionStore.hash(sid), { expires: this.expiryOf(sess), data: JSON.stringify(sess) });
				this.schedule(1000);
				cb && cb(null);
			} catch (err) {
				cb && cb(err);
			}
		}

		touch(sid, sess, cb) {
			const entry = this.sessions.get(FileSessionStore.hash(sid));
			if (entry) {
				entry.expires = this.expiryOf(sess);
				try {
					const data = JSON.parse(entry.data);
					data.cookie = sess.cookie;
					entry.data = JSON.stringify(data);
				} catch { /* keep old data */ }
				this.schedule(60 * 1000);
			}
			cb && cb(null);
		}

		destroy(sid, cb) {
			if (this.sessions.delete(FileSessionStore.hash(sid))) this.schedule(1000);
			cb && cb(null);
		}

		clear(cb) {
			this.sessions.clear();
			this.schedule(1000);
			cb && cb(null);
		}

		length(cb) {
			cb(null, this.sessions.size);
		}
	}

	return FileSessionStore;
};
