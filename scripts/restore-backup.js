#!/usr/bin/env node
'use strict';
/**
 * Restore a data-disk backup made by lib/backup.js. Command line only — restoring
 * is intentionally not available over HTTP.
 *
 *   node scripts/restore-backup.js --list [backupDir]
 *   node scripts/restore-backup.js <archive.tar.gz> <targetDir> [--force]
 *
 * Safe procedure on Render (Shell tab):
 *   1. node scripts/restore-backup.js --list
 *   2. node scripts/restore-backup.js /var/data/backups/backup-XXXX.tar.gz /var/data/restore-check
 *      (restores into an EMPTY folder so you can inspect it first)
 *   3. Stop traffic (suspend or set maintenance), then copy the files you need
 *      from /var/data/restore-check over /var/data, and restart the service.
 * Restoring over a non-empty folder requires --force; it overwrites files with
 * the same path and leaves every other file alone. sessions/ is not in backups,
 * so people will need to sign in again after a full restore.
 */
const fs = require('fs');
const path = require('path');
const { restoreBackup, listBackups } = require('../lib/backup');

async function main() {
	const args = process.argv.slice(2);
	const force = args.includes('--force');
	const pos = args.filter((a) => !a.startsWith('--'));

	if (args.includes('--list')) {
		const dir = pos[0] || path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'backups');
		const list = await listBackups(dir);
		if (!list.length) console.log(`No backups in ${dir}`);
		for (const b of list) console.log(`${b.name}\t${(b.bytes / 1024).toFixed(1)} KB\t${b.createdAt}`);
		return;
	}

	const [archive, target] = pos;
	if (!archive || !target) {
		console.error('Usage: node scripts/restore-backup.js <archive.tar.gz> <targetDir> [--force]\n       node scripts/restore-backup.js --list [backupDir]');
		process.exit(2);
	}
	if (!fs.existsSync(archive)) {
		console.error(`No such archive: ${archive}`);
		process.exit(2);
	}
	const nonEmpty = fs.existsSync(target) && fs.readdirSync(target).length > 0;
	if (nonEmpty && !force) {
		console.error(`${target} is not empty. Restore into an empty folder first, or pass --force to overwrite matching files.`);
		process.exit(2);
	}
	const result = await restoreBackup(archive, target);
	console.log(`Restored ${result.files} files (${result.dirs} folders) into ${path.resolve(target)}`);
}

main().catch((err) => {
	console.error('Restore failed:', err.message);
	process.exit(1);
});
