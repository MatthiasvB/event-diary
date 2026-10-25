import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

export type Db = DatabaseSync;

// Append-only list; the index + 1 is stored in PRAGMA user_version.
const migrations = [
	`
	CREATE TABLE photos (
		id TEXT PRIMARY KEY,            -- also the file name stem in photos/
		file TEXT NOT NULL,             -- file name in photos/, never changed
		mime TEXT NOT NULL,
		original_name TEXT NOT NULL DEFAULT '',
		taken_at TEXT,                  -- EXIF capture time, ISO
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE plants (
		id TEXT PRIMARY KEY,            -- stable, never reused, e.g. ORC-001
		name TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1,
		acquired_on TEXT,               -- YYYY-MM-DD
		notes TEXT NOT NULL DEFAULT '',
		cover_photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE event_types (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		category TEXT NOT NULL DEFAULT '',
		milestone INTEGER NOT NULL DEFAULT 0,
		hint TEXT NOT NULL DEFAULT '',
		fields TEXT NOT NULL DEFAULT '[]' -- JSON FieldTemplate[]
	);

	CREATE TABLE events (
		id INTEGER PRIMARY KEY,
		plant_id TEXT NOT NULL REFERENCES plants(id),
		type_id INTEGER NOT NULL REFERENCES event_types(id),
		date TEXT NOT NULL,             -- YYYY-MM-DD
		note TEXT NOT NULL DEFAULT '',
		batch_id TEXT,                  -- shared by events created together for several plants
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX events_plant ON events(plant_id, date);
	CREATE INDEX events_type ON events(type_id, date);
	CREATE INDEX events_batch ON events(batch_id);

	CREATE TABLE event_attrs (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		PRIMARY KEY (event_id, key)
	);

	-- Plant attributes with history. The current value of a key is the row with the
	-- latest "since"; NULL means "from the beginning". Rows set by an event follow it.
	CREATE TABLE plant_attrs (
		id INTEGER PRIMARY KEY,
		plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		since TEXT,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE
	);
	CREATE INDEX plant_attrs_plant ON plant_attrs(plant_id, key);

	CREATE TABLE event_photos (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		photo_id TEXT NOT NULL REFERENCES photos(id),
		position INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (event_id, photo_id)
	);

	CREATE TABLE settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL             -- JSON
	);

	CREATE TABLE sessions (
		token_hash TEXT PRIMARY KEY,
		username TEXT NOT NULL,
		expires_at INTEGER NOT NULL     -- unix ms
	);
	`
];

export function openDb(file: string): Db {
	if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
	const db = new DatabaseSync(file, { timeout: 5000 });
	db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
	migrate(db);
	return db;
}

function migrate(db: Db) {
	const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
	for (let v = user_version; v < migrations.length; v++) {
		transaction(db, () => {
			db.exec(migrations[v]);
			db.exec(`PRAGMA user_version = ${v + 1}`);
		});
	}
}

export function transaction<T>(db: Db, fn: () => T): T {
	db.exec('BEGIN IMMEDIATE');
	try {
		const result = fn();
		db.exec('COMMIT');
		return result;
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
}

let instance: Db | undefined;

/** The app's database, opened on first use. */
export function db(): Db {
	instance ??= openDb(config.dbFile);
	return instance;
}
