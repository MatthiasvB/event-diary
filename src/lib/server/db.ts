import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalize } from '../suggest.ts';
export type Db = DatabaseSync;

// Schema of a diary. Append-only list; the index + 1 is stored in PRAGMA user_version.
export const DIARY_SCHEMA = [
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
	`,
	`
	-- Pin the cover image: plants showing a photo without a chosen cover keep their first one.
	UPDATE plants SET cover_photo_id = (
		SELECT ep.photo_id FROM events e JOIN event_photos ep ON ep.event_id = e.id
		WHERE e.plant_id = plants.id ORDER BY e.date, e.id, ep.position LIMIT 1
	) WHERE cover_photo_id IS NULL;
	`,
	`
	-- Sessions live in the registry.
	DROP TABLE sessions;
	`,
	`
	-- Type names are unique per category only: several categories may have "Umtopfen".
	-- Rebuilt, since SQLite can't drop a constraint; events keep pointing at the same IDs.
	CREATE TABLE event_types_new (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		category TEXT NOT NULL DEFAULT '',
		milestone INTEGER NOT NULL DEFAULT 0,
		hint TEXT NOT NULL DEFAULT '',
		fields TEXT NOT NULL DEFAULT '[]',  -- JSON FieldTemplate[]
		UNIQUE (name, category)
	);
	INSERT INTO event_types_new SELECT id, name, category, milestone, hint, fields FROM event_types;
	DROP TABLE event_types;
	ALTER TABLE event_types_new RENAME TO event_types;
	`,
	`
	-- Kinds of values per field name (date, number with unit); not listed means text.
	CREATE TABLE field_kinds (
		key TEXT PRIMARY KEY,
		kind TEXT NOT NULL,
		unit TEXT NOT NULL DEFAULT ''
	);

	-- "Erworben am" was a column of every plant; now it is an ordinary property, a date.
	INSERT INTO plant_attrs (plant_id, key, value)
	SELECT p.id, 'Erworben am', p.acquired_on FROM plants p
	WHERE coalesce(p.acquired_on, '') != ''
		AND NOT EXISTS (SELECT 1 FROM plant_attrs a WHERE a.plant_id = p.id AND a.key = 'Erworben am');
	INSERT INTO field_kinds (key, kind)
	SELECT 'Erworben am', 'date' WHERE EXISTS (SELECT 1 FROM plant_attrs WHERE key = 'Erworben am');
	ALTER TABLE plants DROP COLUMN acquired_on;
	`
];

export function openDb(file: string, schema = DIARY_SCHEMA): Db {
	if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
	const db = new DatabaseSync(file, { timeout: 5000 });
	db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
	// For searching text like the suggestions do: case, umlauts and spacing don't matter.
	db.function('normalized', { deterministic: true }, (s) => normalize(String(s ?? '')));
	migrate(db, schema);
	return db;
}

function migrate(db: Db, migrations: string[]) {
	const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
	if (user_version >= migrations.length) return;
	// Foreign keys are off while migrating so tables can be rebuilt (SQLite's documented
	// way); each migration is checked before it is committed.
	db.exec('PRAGMA foreign_keys = OFF');
	try {
		for (let v = user_version; v < migrations.length; v++) {
			transaction(db, () => {
				db.exec(migrations[v]);
				if (db.prepare('PRAGMA foreign_key_check').all().length) {
					throw new Error(`Migration ${v + 1} would break references between tables`);
				}
				db.exec(`PRAGMA user_version = ${v + 1}`);
			});
		}
	} finally {
		db.exec('PRAGMA foreign_keys = ON');
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
