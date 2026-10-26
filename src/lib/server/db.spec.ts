import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { DIARY_SCHEMA, openDb } from './db.ts';

it('lets existing diaries have a type name in several categories', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-diary-'));
	try {
		const file = path.join(dir, 'diary.sqlite');
		// A diary from before: type names were unique across all categories.
		const before = openDb(file, DIARY_SCHEMA.slice(0, 3));
		before.exec(`
			INSERT INTO plants (id, name) VALUES ('P-001', 'Dendrobium');
			INSERT INTO event_types (id, name, category) VALUES (7, 'Umtopfen', 'Pflege');
			INSERT INTO events (plant_id, type_id, date) VALUES ('P-001', 7, '2026-01-01');`);
		before.close();

		const db = openDb(file);
		db.prepare("INSERT INTO event_types (name, category) VALUES ('Umtopfen', 'Haus')").run();
		expect(db.prepare('SELECT type_id FROM events').get()).toEqual({ type_id: 7 });
		expect(() =>
			db.prepare("INSERT INTO event_types (name, category) VALUES ('Umtopfen', 'Haus')").run()
		).toThrow(/UNIQUE/);
		expect(() =>
			db
				.prepare("INSERT INTO events (plant_id, type_id, date) VALUES ('P-001', 99, '2026-01-02')")
				.run()
		).toThrow(/FOREIGN KEY/);
		db.close();
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
