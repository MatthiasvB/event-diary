// Safe while the app runs, because VACUUM INTO reads within one transaction.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

function databases(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return (fs.readdirSync(dir, { recursive: true }) as string[])
		.filter((f) => f.endsWith('.sqlite'))
		.sort();
}

/** Returns the snapshots' paths relative to snapshotDir. */
export function writeSnapshots(dbDir: string, snapshotDir: string): string[] {
	const files = databases(dbDir);
	for (const file of files) {
		const target = path.join(snapshotDir, file);
		const tmp = `${target}.tmp`;
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.rmSync(tmp, { force: true });
		const db = new DatabaseSync(path.join(dbDir, file), { timeout: 5000 });
		try {
			db.prepare('VACUUM INTO ?').run(tmp);
		} finally {
			db.close();
		}
		// Atomic replace: a backup never sees a half-written snapshot.
		fs.renameSync(tmp, target);
	}
	// Snapshots of databases that no longer exist (e.g. moved) must not come back on restore.
	for (const stale of databases(snapshotDir).filter((f) => !files.includes(f))) {
		fs.rmSync(path.join(snapshotDir, stale));
	}
	return files;
}

if (import.meta.main) {
	const files = writeSnapshots(config.dbDir, config.snapshotDir);
	console.log(`Snapshots written to ${config.snapshotDir}: ${files.join(', ')}`);
}
