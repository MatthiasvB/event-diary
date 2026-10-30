import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { openDb, type Db } from './db.ts';
import { openRegistry } from './registry.ts';

// A diary at version 5.
const DIARY_V5 = `
	CREATE TABLE photos (
		id TEXT PRIMARY KEY, file TEXT NOT NULL, mime TEXT NOT NULL,
		original_name TEXT NOT NULL DEFAULT '', taken_at TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE TABLE plants (
		id TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
		notes TEXT NOT NULL DEFAULT '',
		cover_photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE TABLE event_types (
		id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
		milestone INTEGER NOT NULL DEFAULT 0, hint TEXT NOT NULL DEFAULT '',
		fields TEXT NOT NULL DEFAULT '[]', UNIQUE (name, category)
	);
	CREATE TABLE events (
		id INTEGER PRIMARY KEY, plant_id TEXT NOT NULL REFERENCES plants(id),
		type_id INTEGER NOT NULL REFERENCES event_types(id), date TEXT NOT NULL,
		note TEXT NOT NULL DEFAULT '', batch_id TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX events_plant ON events(plant_id, date);
	CREATE INDEX events_type ON events(type_id, date);
	CREATE INDEX events_batch ON events(batch_id);
	CREATE TABLE event_attrs (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (event_id, key)
	);
	CREATE TABLE plant_attrs (
		id INTEGER PRIMARY KEY,
		plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
		key TEXT NOT NULL, value TEXT NOT NULL, since TEXT,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE
	);
	CREATE INDEX plant_attrs_plant ON plant_attrs(plant_id, key);
	CREATE TABLE event_photos (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		photo_id TEXT NOT NULL REFERENCES photos(id),
		position INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (event_id, photo_id)
	);
	CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
	CREATE TABLE field_kinds (key TEXT PRIMARY KEY, kind TEXT NOT NULL, unit TEXT NOT NULL DEFAULT '');
	PRAGMA user_version = 5;
`;

let dir: string;
beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-diary-'));
});
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

function oldDatabase(name: string, sql: string): string {
	const file = path.join(dir, name);
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

function structure(db: Db) {
	const tables = all(db, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name") as {
		name: string;
	}[];
	return tables.map(({ name }) => ({
		name,
		columns: all(db, `PRAGMA table_info(${name})`),
		references: all(db, `PRAGMA foreign_key_list(${name})`),
		indexes: (all(db, `PRAGMA index_list(${name})`) as { name: string }[])
			.map((i) => ({ ...i, columns: all(db, `PRAGMA index_info(${i.name})`) }))
			.sort((a, b) => a.name.localeCompare(b.name))
	}));
}

it('renames plants to objects and photos to files, numbering the objects', () => {
	const file = oldDatabase(
		'diary.sqlite',
		DIARY_V5 +
			`
		INSERT INTO photos (id, file, mime) VALUES ('f1', 'f1.jpg', 'image/jpeg');
		INSERT INTO plants (id, name, cover_photo_id, created_at) VALUES
			('P-001', 'Newer', NULL, '2026-02-01'), ('ORC-001', 'Older', 'f1', '2025-01-01');
		INSERT INTO event_types (id, name, fields)
			VALUES (3, 'Umzug', '[{"key":"Standort","target":"plant"}]');
		INSERT INTO events (id, plant_id, type_id, date) VALUES (5, 'P-001', 3, '2026-03-01');
		INSERT INTO plant_attrs (plant_id, key, value, since, event_id)
			VALUES ('P-001', 'Standort', 'Küche', '2026-03-01', 5);
		INSERT INTO event_photos (event_id, photo_id) VALUES (5, 'f1');`
	);

	const db = openDb(file);
	expect(all(db, 'SELECT id, name, cover_photo_id FROM objects ORDER BY id')).toEqual([
		{ id: 1, name: 'Older', cover_photo_id: 'f1' },
		{ id: 2, name: 'Newer', cover_photo_id: null }
	]);
	expect(all(db, 'SELECT id, object_id FROM events')).toEqual([{ id: 5, object_id: 2 }]);
	expect(all(db, 'SELECT object_id, key, event_id FROM object_attrs')).toEqual([
		{ object_id: 2, key: 'Standort', event_id: 5 }
	]);
	expect(all(db, 'SELECT event_id, file_id FROM event_files')).toEqual([
		{ event_id: 5, file_id: 'f1' }
	]);
	expect(all(db, 'SELECT fields FROM event_types')).toEqual([
		{ fields: '[{"key":"Standort","target":"object"}]' }
	]);
	// References still hold: deleting the event takes the property it set along.
	db.prepare('DELETE FROM events WHERE id = 5').run();
	expect(all(db, 'SELECT * FROM object_attrs')).toEqual([]);

	expect(structure(db)).toEqual(structure(openDb(':memory:')));
	db.close();
});

it('renames the diary type in the registry', () => {
	const file = oldDatabase(
		'registry.sqlite',
		`
		CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, expires_at INTEGER NOT NULL);
		CREATE TABLE diaries (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE TABLE members (
			diary_id TEXT NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
			username TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY (diary_id, username)
		);
		CREATE INDEX members_user ON members(username);
		CREATE TABLE invites (
			token_hash TEXT PRIMARY KEY,
			diary_id TEXT NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
			role TEXT NOT NULL, created_by TEXT NOT NULL, expires_at INTEGER NOT NULL
		);
		INSERT INTO diaries (id, name, type) VALUES ('orchideen', 'Orchideen', 'plants');
		PRAGMA user_version = 2;`
	);

	const reg = openRegistry(file);
	expect(all(reg, 'SELECT id, type FROM diaries')).toEqual([{ id: 'orchideen', type: 'objects' }]);
	expect(structure(reg)).toEqual(structure(openRegistry(':memory:')));
	reg.close();
});

it('refuses databases too old to be migrated', () => {
	const file = oldDatabase(
		'diary.sqlite',
		'CREATE TABLE plants (id TEXT PRIMARY KEY); PRAGMA user_version = 4;'
	);
	expect(() => openDb(file)).toThrow(/too old/);
});
