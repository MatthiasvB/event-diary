import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { migrateDb, openDb, transaction, type DataDirs, type Db, type Schema } from './db.ts';
import { DIARY_SCHEMA, openDiary } from './diarySchema.ts';
import { migrateAll } from './migrate.ts';
import { createDiary, diaryFile, openRegistry, registryFile } from './registry.ts';

let dirs: DataDirs;
beforeEach(() => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-diary-'));
	dirs = {
		dbDir: path.join(dir, 'db'),
		preMigrationDir: path.join(dir, 'pre-migration')
	};
});
afterEach(() => {
	fs.rmSync(path.dirname(dirs.dbDir), { recursive: true, force: true });
});

function oldDatabase(file: string, sql: string): string {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const db = new DatabaseSync(file);
	db.exec(sql);
	db.close();
	return file;
}

const all = (db: Db, sql: string) =>
	db
		.prepare(sql)
		.all()
		.map((r) => ({ ...r }));

const version = (file: string) => {
	const db = new DatabaseSync(file);
	const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
	db.close();
	return user_version;
};

const LETTERS: Schema = {
	version: 3,
	create: `
		CREATE TABLE letters (id INTEGER PRIMARY KEY, lower TEXT NOT NULL, upper TEXT);
		CREATE TABLE marks (letter_id INTEGER NOT NULL REFERENCES letters(id));`,
	migrations: {
		2: 'ALTER TABLE letters ADD COLUMN upper TEXT',
		3: (db) => db.exec('UPDATE letters SET upper = upper(lower)')
	}
};

const lettersV1 = (file: string) =>
	oldDatabase(
		file,
		`CREATE TABLE letters (id INTEGER PRIMARY KEY, lower TEXT NOT NULL);
		CREATE TABLE marks (letter_id INTEGER NOT NULL REFERENCES letters(id));
		INSERT INTO letters (id, lower) VALUES (1, 'a');
		PRAGMA user_version = 1;`
	);

it('migrates step by step, and keeps a copy of the database as it was', async () => {
	const file = lettersV1(path.join(dirs.dbDir, 'diaries', 'abc.sqlite'));
	await migrateDb(file, LETTERS, dirs);

	expect(version(file)).toBe(3);
	const db = openDb(file, LETTERS);
	expect(all(db, 'SELECT lower, upper FROM letters')).toEqual([{ lower: 'a', upper: 'A' }]);
	db.close();
	expect(version(path.join(dirs.preMigrationDir, 'diaries', 'abc.v1.sqlite'))).toBe(1);
});

it('keeps the steps that worked when a later one fails or breaks references', async () => {
	const file = lettersV1(path.join(dirs.dbDir, 'abc.sqlite'));
	const broken: Schema = {
		...LETTERS,
		migrations: { ...LETTERS.migrations, 3: 'INSERT INTO marks (letter_id) VALUES (99)' }
	};
	await expect(migrateDb(file, broken, dirs)).rejects.toThrow(/references/);
	expect(version(file)).toBe(2);

	const failing: Schema = { ...LETTERS, migrations: { ...LETTERS.migrations, 3: 'NOT SQL' } };
	await expect(migrateDb(file, failing, dirs)).rejects.toThrow();
	expect(version(file)).toBe(2);
});

it('refuses databases too old to be migrated, or newer than the app', async () => {
	const file = lettersV1(path.join(dirs.dbDir, 'abc.sqlite'));
	await expect(migrateDb(file, { ...LETTERS, migrations: {} }, dirs)).rejects.toThrow(/too old/);
	const newer = oldDatabase(path.join(dirs.dbDir, 'newer.sqlite'), 'PRAGMA user_version = 5');
	await expect(migrateDb(newer, LETTERS, dirs)).rejects.toThrow(/newer/);
});

it('opens only databases at the current version', () => {
	const file = lettersV1(path.join(dirs.dbDir, 'abc.sqlite'));
	expect(() => openDb(file, LETTERS)).toThrow(/this app needs/);
});

it('leaves current databases alone when the app starts, and refuses ones too old for it', async () => {
	const reg = openRegistry(registryFile(dirs.dbDir));
	const id = createDiary(reg, 'Orchideen', 'objects', 'alice');
	reg.close();
	const diary = diaryFile(dirs.dbDir, id);
	openDiary(diary).close();

	await migrateAll(dirs);
	expect(version(diary)).toBe(DIARY_SCHEMA.version);
	expect(fs.existsSync(dirs.preMigrationDir)).toBe(false);

	const oldest = Math.min(
		DIARY_SCHEMA.version,
		...Object.keys(DIARY_SCHEMA.migrations).map(Number)
	);
	const old = new DatabaseSync(diary);
	old.exec(`PRAGMA user_version = ${oldest - 2}`);
	old.close();
	await expect(migrateAll(dirs)).rejects.toThrow(/too old/);
});

function diaryWithEvent() {
	const db = openDiary(':memory:');
	db.exec(`
		INSERT INTO fields (id, name, role) VALUES (1, 'Standort', 'property');
		INSERT INTO objects (id, name) VALUES (1, 'A'), (2, 'B');
		INSERT INTO event_types (id, name) VALUES (1, 'Umzug');
		INSERT INTO events (id, type_id, date) VALUES (1, 1, '2026-05-01');
		INSERT INTO event_objects (event_id, object_id) VALUES (1, 1);`);
	return db;
}

it('keeps details and properties apart, and units for numbers', () => {
	const db = diaryWithEvent();
	const detail = "INSERT INTO event_details (event_id, field_id, value) VALUES (1, 1, 'Bad')";
	expect(() => transaction(db, () => db.exec(detail))).toThrow(/FOREIGN KEY/);
	expect(() => db.exec("UPDATE fields SET unit = 'cm' WHERE id = 1")).toThrow(/CHECK/);
	expect(() => db.exec("UPDATE fields SET role = 'detail', position = 0 WHERE id = 1")).toThrow(
		/CHECK/
	);
});

it("dates a change by its event, and keeps it with one of the event's objects", () => {
	const db = diaryWithEvent();
	db.exec(
		"INSERT INTO property_values (id, object_id, field_id, value, event_id) VALUES (1, 1, 1, 'Bad', 1)"
	);
	expect(() => db.exec("UPDATE property_values SET since = '2026-01-01' WHERE id = 1")).toThrow(
		/CHECK/
	);
	expect(() =>
		transaction(db, () => db.exec('UPDATE property_values SET object_id = 2 WHERE id = 1'))
	).toThrow(/FOREIGN KEY/);
	db.exec('UPDATE event_objects SET object_id = 2 WHERE event_id = 1');
	expect(all(db, 'SELECT object_id FROM property_values')).toEqual([{ object_id: 2 }]);
});

it('deletes an event once its last object is gone', () => {
	const db = diaryWithEvent();
	db.exec('INSERT INTO event_objects (event_id, object_id) VALUES (1, 2)');
	db.exec('DELETE FROM event_objects WHERE object_id = 1');
	expect(all(db, 'SELECT id FROM events')).toEqual([{ id: 1 }]);
	db.exec('DELETE FROM event_objects WHERE object_id = 2');
	expect(all(db, 'SELECT id FROM events')).toEqual([]);
});
