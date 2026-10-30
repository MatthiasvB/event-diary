import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { t } from '../i18n.ts';
import { migrateDb, transaction, type DataDirs, type Db } from './db.ts';
import { DIARY_SCHEMA, openDiary } from './diarySchema.ts';
import { findPhotoType, findType, getType } from './eventTypes.ts';
import { getFieldKinds, getPropertyOrder } from './fields.ts';
import { migrateAll } from './migrate.ts';
import { getOverviewColumns } from './overview.ts';
import { attrHistory } from './objects.ts';
import { diaryFile, openRegistry, REGISTRY_SCHEMA, registryFile } from './registry.ts';

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

const REGISTRY_V2 = `
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
	PRAGMA user_version = 2;
`;

let dirs: DataDirs;
beforeEach(() => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-diary-'));
	dirs = {
		dbDir: path.join(dir, 'db'),
		photosDir: path.join(dir, 'photos'),
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

it('renames plants to objects and photos to files, numbering the objects', async () => {
	const file = oldDatabase(
		path.join(dirs.dbDir, 'diary.sqlite'),
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

	await migrateDb(file, DIARY_SCHEMA, dirs);
	const db = openDiary(file);
	expect(all(db, 'SELECT id, name, cover_photo_id FROM objects ORDER BY id')).toEqual([
		{ id: 1, name: 'Older', cover_photo_id: 'f1' },
		{ id: 2, name: 'Newer', cover_photo_id: null }
	]);
	expect(all(db, 'SELECT id, object_id FROM events')).toEqual([{ id: 5, object_id: 2 }]);
	expect(
		all(
			db,
			`SELECT a.object_id, f.name AS key, a.event_id
			FROM property_values a JOIN fields f ON f.id = a.field_id`
		)
	).toEqual([{ object_id: 2, key: 'Standort', event_id: 5 }]);
	expect(all(db, 'SELECT event_id, file_id FROM event_files')).toEqual([
		{ event_id: 5, file_id: 'f1' }
	]);
	expect(getType(db, 3)?.fields).toEqual([{ key: 'Standort', target: 'object' }]);
	// References still hold: deleting the event takes the property it set along.
	db.prepare('DELETE FROM events WHERE id = 5').run();
	expect(all(db, 'SELECT * FROM property_values')).toEqual([]);

	expect(structure(db)).toEqual(structure(openDiary(':memory:')));
	db.close();
});

it('renames the diary type in the registry', async () => {
	const file = oldDatabase(registryFile(dirs.dbDir), REGISTRY_V2);
	await migrateDb(file, REGISTRY_SCHEMA, dirs);
	const reg = openRegistry(file);
	expect(all(reg, 'SELECT id, type FROM diaries')).toEqual([{ id: 'orchideen', type: 'objects' }]);
	expect(structure(reg)).toEqual(structure(openRegistry(':memory:')));
	reg.close();
});

const fixture = (version: number) =>
	fs.readFileSync(path.join(import.meta.dirname, 'testing', `diary-v${version}.sql`), 'utf8');

it('measures old images at version 8', async () => {
	const file = oldDatabase(
		path.join(dirs.dbDir, 'diary.sqlite'),
		fixture(7) +
			`INSERT INTO files (id, file, mime) VALUES ('a', 'a.jpg', 'image/jpeg'),
				('gone', 'gone.jpg', 'image/jpeg'), ('doc', 'doc.pdf', 'application/pdf');`
	);
	fs.mkdirSync(dirs.photosDir);
	execFileSync('vips', ['black', path.join(dirs.photosDir, 'a.jpg'), '40', '20']);

	await migrateDb(file, DIARY_SCHEMA, dirs);
	const db = openDiary(file);
	expect(
		all(db, "SELECT id, width, height FROM files WHERE id IN ('a', 'doc', 'gone') ORDER BY id")
	).toEqual([
		{ id: 'a', width: 40, height: 20 },
		{ id: 'doc', width: null, height: null },
		{ id: 'gone', width: 0, height: 0 }
	]);
	db.close();
});

it('gives every field name one field with its role, kind and place at version 9', async () => {
	const file = oldDatabase(
		path.join(dirs.dbDir, 'diary.sqlite'),
		fixture(8) +
			`UPDATE event_types SET fields = '[{"key":"Topf","target":"object","default":"Ton"},'
				|| '{"key":"Topf","target":"event"}]' WHERE name = 'Kontrolle' AND category = 'Haus';
			INSERT INTO event_attrs (event_id, key, value)
				SELECT id, 'Topf', 'Beton' FROM events WHERE note = 'Kellerdecke trocken';
			INSERT INTO field_kinds (key, kind, unit) VALUES ('Höhe', 'number', '');
			UPDATE settings SET value = '["Produkt","Standort"]' WHERE key = 'propertyOrder';`
	);

	await migrateDb(file, DIARY_SCHEMA, dirs);
	const db = openDiary(file);
	// A template set it on the object, so it is a property, and the detail is its first change.
	expect(attrHistory(db, 4).Topf).toEqual([
		expect.objectContaining({ value: 'Beton', since: '2026-05-02' })
	]);
	expect(findType(db, 'Kontrolle', 'Haus')?.fields).toEqual([
		{ key: 'Topf', target: 'object', default: 'Ton' }
	]);
	expect(getFieldKinds(db).Höhe).toEqual({ kind: 'number', unit: '' });
	expect(getPropertyOrder(db)).toEqual(['Standort']);
	expect(
		all(
			db,
			`SELECT name FROM sqlite_master
			WHERE name IN ('event_attrs', 'field_kinds', 'object_attrs_v8')`
		)
	).toEqual([]);
	db.close();
});

it('dates changes by their event at version 10, and keeps them with its object', async () => {
	const file = oldDatabase(path.join(dirs.dbDir, 'diary.sqlite'), fixture(9));
	await migrateDb(file, DIARY_SCHEMA, dirs);
	const db = openDiary(file);
	expect(
		all(
			db,
			'SELECT count(*) AS n FROM property_values WHERE event_id IS NOT NULL AND since IS NOT NULL'
		)
	).toEqual([{ n: 0 }]);

	const change = all(
		db,
		'SELECT id, event_id, object_id FROM property_values WHERE event_id IS NOT NULL LIMIT 1'
	)[0] as { id: number; event_id: number; object_id: number };
	const other = change.object_id === 1 ? 2 : 1;
	expect(() =>
		db.exec(`UPDATE property_values SET since = '2026-01-01' WHERE id = ${change.id}`)
	).toThrow(/CHECK/);
	expect(() =>
		transaction(db, () =>
			db.exec(`UPDATE property_values SET object_id = ${other} WHERE id = ${change.id}`)
		)
	).toThrow(/FOREIGN KEY/);
	db.exec(`UPDATE events SET object_id = ${other} WHERE id = ${change.event_id}`);
	expect(all(db, `SELECT object_id FROM property_values WHERE id = ${change.id}`)).toEqual([
		{ object_id: other }
	]);
	db.close();
});

it('moves categories, the photo type and the overview columns into tables at version 11', async () => {
	const file = oldDatabase(
		path.join(dirs.dbDir, 'diary.sqlite'),
		fixture(10) +
			`UPDATE settings SET value = json_insert(value, '$[#]', json('{"label":"","typeIds":[1]}'),
				'$[#]', json('{"label":"Weg","typeIds":[999]}')) WHERE key = 'overviewColumns';`
	);
	await migrateDb(file, DIARY_SCHEMA, dirs);
	const db = openDiary(file);
	expect(all(db, 'SELECT name FROM categories ORDER BY name').map((r) => r.name)).toEqual(
		['Haus', 'Pflege', t.events.photoTypeCategory].sort()
	);
	expect(findPhotoType(db)?.name).toBe(t.events.photoType);
	expect(getOverviewColumns(db).map((c) => [c.label, c.typeIds.length])).toEqual([
		['Gedüngt', 1],
		['Umgetopft', 1],
		['Weg', 0]
	]);
	const triggers = (sql: Db) =>
		all(sql, "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name");
	expect(triggers(db)).toEqual(triggers(openDiary(':memory:')));
	expect(all(db, "SELECT name FROM sqlite_master WHERE name = 'settings'")).toEqual([]);
	db.close();
});

it('keeps details and properties apart, and units for numbers', () => {
	const db = openDiary(':memory:');
	db.exec(`
		INSERT INTO fields (id, name, role) VALUES (1, 'Standort', 'property');
		INSERT INTO objects (id, name) VALUES (1, 'A');
		INSERT INTO event_types (id, name) VALUES (1, 'Umzug');
		INSERT INTO events (id, object_id, type_id, date) VALUES (1, 1, 1, '2026-05-01');`);
	const detail = "INSERT INTO event_details (event_id, field_id, value) VALUES (1, 1, 'Bad')";
	expect(() => transaction(db, () => db.exec(detail))).toThrow(/FOREIGN KEY/);
	expect(() => db.exec("UPDATE fields SET unit = 'cm' WHERE id = 1")).toThrow(/CHECK/);
	expect(() => db.exec("UPDATE fields SET role = 'detail', position = 0 WHERE id = 1")).toThrow(
		/CHECK/
	);
});

it('migrates the registry and every diary when the app starts, and keeps copies', async () => {
	const registry = oldDatabase(registryFile(dirs.dbDir), REGISTRY_V2);
	const diary = oldDatabase(diaryFile(dirs.dbDir, 'orchideen'), DIARY_V5);

	await migrateAll(dirs);
	expect([version(registry), version(diary)]).toEqual([
		REGISTRY_SCHEMA.version,
		DIARY_SCHEMA.version
	]);
	expect(version(path.join(dirs.preMigrationDir, 'registry.v2.sqlite'))).toBe(2);
	expect(version(path.join(dirs.preMigrationDir, 'diaries', 'orchideen.v5.sqlite'))).toBe(5);
});

it('opens only databases at the current version', () => {
	const file = oldDatabase(path.join(dirs.dbDir, 'diary.sqlite'), DIARY_V5);
	expect(() => openDiary(file)).toThrow(/this app needs/);
});

it('refuses databases too old to be migrated', async () => {
	const file = oldDatabase(
		path.join(dirs.dbDir, 'diary.sqlite'),
		'CREATE TABLE plants (id TEXT PRIMARY KEY); PRAGMA user_version = 4;'
	);
	await expect(migrateDb(file, DIARY_SCHEMA, dirs)).rejects.toThrow(/too old/);
});
