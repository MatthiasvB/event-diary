import { openDb, type Db, type Schema } from './db.ts';
import { measureOldImages } from './files.ts';
import { promoteToProperties } from './objects.ts';

export const DIARY_SCHEMA: Schema = {
	version: 8,
	create: `
	CREATE TABLE files (
		id TEXT PRIMARY KEY,
		file TEXT NOT NULL,
		mime TEXT NOT NULL,
		original_name TEXT NOT NULL DEFAULT '',
		taken_at TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		width INTEGER,                  -- after EXIF rotation, 0 if unreadable
		height INTEGER
	);

	CREATE TABLE objects (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1,
		notes TEXT NOT NULL DEFAULT '',
		cover_photo_id TEXT REFERENCES files(id) ON DELETE SET NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE event_types (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		category TEXT NOT NULL DEFAULT '',
		milestone INTEGER NOT NULL DEFAULT 0,
		hint TEXT NOT NULL DEFAULT '',
		fields TEXT NOT NULL DEFAULT '[]',  -- JSON FieldTemplate[]
		UNIQUE (name, category)
	);

	CREATE TABLE events (
		id INTEGER PRIMARY KEY,
		object_id INTEGER NOT NULL REFERENCES objects(id),
		type_id INTEGER NOT NULL REFERENCES event_types(id),
		date TEXT NOT NULL,
		note TEXT NOT NULL DEFAULT '',
		batch_id TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX events_object ON events(object_id, date);
	CREATE INDEX events_type ON events(type_id, date);
	CREATE INDEX events_batch ON events(batch_id);

	CREATE TABLE event_attrs (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		PRIMARY KEY (event_id, key)
	);

	-- A key's current value is the row with the latest "since". NULL means "from the
	-- beginning". A row set by an event carries its date and goes with it.
	CREATE TABLE object_attrs (
		id INTEGER PRIMARY KEY,
		object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
		key TEXT NOT NULL,
		value TEXT NOT NULL,
		since TEXT,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE
	);
	CREATE INDEX object_attrs_object ON object_attrs(object_id, key);

	CREATE TABLE event_files (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		file_id TEXT NOT NULL REFERENCES files(id),
		position INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (event_id, file_id)
	);

	-- A name not listed here is plain text.
	CREATE TABLE field_kinds (
		key TEXT PRIMARY KEY,
		kind TEXT NOT NULL,
		unit TEXT NOT NULL DEFAULT ''
	);

	CREATE TABLE settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL             -- JSON
	);
	`,
	migrations: {
		6: `
		CREATE TEMP TABLE object_ids AS
		SELECT id AS old, row_number() OVER (ORDER BY created_at, id) AS new FROM plants;

		CREATE TABLE files (
			id TEXT PRIMARY KEY,
			file TEXT NOT NULL,
			mime TEXT NOT NULL,
			original_name TEXT NOT NULL DEFAULT '',
			taken_at TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		INSERT INTO files SELECT id, file, mime, original_name, taken_at, created_at FROM photos;

		CREATE TABLE objects (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			active INTEGER NOT NULL DEFAULT 1,
			notes TEXT NOT NULL DEFAULT '',
			cover_photo_id TEXT REFERENCES files(id) ON DELETE SET NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		INSERT INTO objects SELECT m.new, p.name, p.active, p.notes, p.cover_photo_id, p.created_at
		FROM plants p JOIN object_ids m ON m.old = p.id;

		CREATE TABLE events_new (
			id INTEGER PRIMARY KEY,
			object_id INTEGER NOT NULL REFERENCES objects(id),
			type_id INTEGER NOT NULL REFERENCES event_types(id),
			date TEXT NOT NULL,
			note TEXT NOT NULL DEFAULT '',
			batch_id TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		INSERT INTO events_new SELECT e.id, m.new, e.type_id, e.date, e.note, e.batch_id, e.created_at
		FROM events e JOIN object_ids m ON m.old = e.plant_id;

		-- A key's current value is the row with the latest "since". NULL means "from the
		-- beginning". A row set by an event carries its date and goes with it.
		CREATE TABLE object_attrs (
			id INTEGER PRIMARY KEY,
			object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			since TEXT,
			event_id INTEGER REFERENCES events(id) ON DELETE CASCADE
		);
		INSERT INTO object_attrs SELECT a.id, m.new, a.key, a.value, a.since, a.event_id
		FROM plant_attrs a JOIN object_ids m ON m.old = a.plant_id;

		CREATE TABLE event_files (
			event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
			file_id TEXT NOT NULL REFERENCES files(id),
			position INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (event_id, file_id)
		);
		INSERT INTO event_files SELECT event_id, photo_id, position FROM event_photos;

		DROP TABLE event_photos;
		DROP TABLE plant_attrs;
		DROP TABLE events;
		DROP TABLE plants;
		DROP TABLE photos;
		DROP TABLE temp.object_ids;
		-- event_attrs keeps referring to "events", which is the new table after this.
		ALTER TABLE events_new RENAME TO events;
		CREATE INDEX events_object ON events(object_id, date);
		CREATE INDEX events_type ON events(type_id, date);
		CREATE INDEX events_batch ON events(batch_id);
		CREATE INDEX object_attrs_object ON object_attrs(object_id, key);

		UPDATE event_types SET fields = replace(fields, '"target":"plant"', '"target":"object"');
		`,
		7: `
		ALTER TABLE files ADD COLUMN width INTEGER;
		ALTER TABLE files ADD COLUMN height INTEGER;
		`,
		8: async (db, dirs) => {
			promoteToProperties(db);
			await measureOldImages(db, dirs.photosDir);
		}
	}
};

export function openDiary(file: string): Db {
	return openDb(file, DIARY_SCHEMA);
}
