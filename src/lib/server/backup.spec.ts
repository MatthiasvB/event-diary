import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeSnapshots } from './backup.ts';
import { openDb } from './db.ts';

const dirs: string[] = [];
function tempDir() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-diary-'));
	dirs.push(dir);
	return dir;
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('writeSnapshots', () => {
	it('captures every database while they stay open, at the same relative path', () => {
		const dir = tempDir();
		const dbDir = path.join(dir, 'db');
		const a = openDb(path.join(dbDir, 'diaries', 'a.sqlite'));
		const b = openDb(path.join(dbDir, 'diaries', 'b.sqlite'));
		a.prepare("INSERT INTO plants (id, name) VALUES ('P-001', 'Phalaenopsis')").run();

		const files = writeSnapshots(dbDir, path.join(dir, 'snapshot'));
		expect(files).toEqual([path.join('diaries', 'a.sqlite'), path.join('diaries', 'b.sqlite')]);
		// Writes after the snapshot must not show up in it.
		a.prepare("INSERT INTO plants (id, name) VALUES ('P-002', 'Later')").run();

		const restored = openDb(path.join(dir, 'snapshot', 'diaries', 'a.sqlite'));
		const rows = restored.prepare('SELECT id, name FROM plants').all();
		expect(rows.map((r) => ({ ...r }))).toEqual([{ id: 'P-001', name: 'Phalaenopsis' }]);
		restored.close();
		a.close();
		b.close();
	});

	it('replaces snapshots and removes those of databases that are gone', () => {
		const dir = tempDir();
		const dbDir = path.join(dir, 'db');
		const snapshotDir = path.join(dir, 'snapshot');
		const live = openDb(path.join(dbDir, 'diary.sqlite'));
		writeSnapshots(dbDir, snapshotDir);
		live.close();

		// The database moves.
		fs.mkdirSync(path.join(dbDir, 'diaries'));
		fs.renameSync(path.join(dbDir, 'diary.sqlite'), path.join(dbDir, 'diaries', 'x.sqlite'));
		writeSnapshots(dbDir, snapshotDir);

		expect(fs.existsSync(path.join(snapshotDir, 'diary.sqlite'))).toBe(false);
		expect(fs.existsSync(path.join(snapshotDir, 'diaries', 'x.sqlite'))).toBe(true);
		expect(
			fs.readdirSync(snapshotDir, { recursive: true }).some((f) => String(f).endsWith('.tmp'))
		).toBe(false);
	});
});
