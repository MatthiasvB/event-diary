// Consistent database snapshot for file-level backups (restic etc.).
// Safe while the app is running: VACUUM INTO reads within one transaction.
// Run directly as the backup command: `node src/lib/server/backup.ts`.
import fs from 'node:fs';
import path from 'node:path';
import { config, SNAPSHOT_FILE } from './config.ts';
import { openDb } from './db.ts';

export function writeSnapshot(dbFile: string, snapshotDir: string): string {
	fs.mkdirSync(snapshotDir, { recursive: true });
	const target = path.join(snapshotDir, SNAPSHOT_FILE);
	const tmp = `${target}.tmp`;
	fs.rmSync(tmp, { force: true });

	const db = openDb(dbFile);
	try {
		db.prepare('VACUUM INTO ?').run(tmp);
	} finally {
		db.close();
	}
	// Atomic replace: a backup never sees a half-written snapshot.
	fs.renameSync(tmp, target);
	return target;
}

if (import.meta.main) {
	const file = writeSnapshot(config.dbFile, config.snapshotDir);
	console.log(`Snapshot written to ${file}`);
}
