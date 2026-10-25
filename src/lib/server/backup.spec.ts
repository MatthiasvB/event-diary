import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeSnapshot } from './backup.ts';
import { openDb } from './db.ts';

const dirs: string[] = [];
function tempDir() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-diary-'));
	dirs.push(dir);
	return dir;
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('writeSnapshot', () => {
	it('captures committed data while the live database stays open', () => {
		const dir = tempDir();
		const dbFile = path.join(dir, 'db', 'diary.sqlite');
		const live = openDb(dbFile);
		live.prepare("INSERT INTO plants (id, name) VALUES ('P-001', 'Phalaenopsis')").run();

		const snapshot = writeSnapshot(dbFile, path.join(dir, 'snapshot'));
		// Writes after the snapshot must not show up in it.
		live.prepare("INSERT INTO plants (id, name) VALUES ('P-002', 'Later')").run();

		const restored = openDb(snapshot);
		const rows = restored.prepare('SELECT id, name FROM plants').all();
		expect(rows.map((r) => ({ ...r }))).toEqual([{ id: 'P-001', name: 'Phalaenopsis' }]);
		restored.close();
		live.close();
	});

	it('replaces an existing snapshot', () => {
		const dir = tempDir();
		const dbFile = path.join(dir, 'diary.sqlite');
		const live = openDb(dbFile);
		const snapshotDir = path.join(dir, 'snapshot');
		writeSnapshot(dbFile, snapshotDir);
		live.prepare("INSERT INTO plants (id, name) VALUES ('P-001', 'A')").run();
		const snapshot = writeSnapshot(dbFile, snapshotDir);

		const restored = openDb(snapshot);
		expect(restored.prepare('SELECT count(*) AS n FROM plants').get()).toEqual({ n: 1 });
		expect(fs.readdirSync(snapshotDir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
		restored.close();
		live.close();
	});
});
