import { openDb, type Db, type Schema } from './db.ts';
import { measureOldImages } from './files.ts';

// See docs/adr/0001-fields.md for the role columns.
const FIELDS = `
	CREATE TABLE fields (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE CHECK (name != ''),
		role TEXT NOT NULL CHECK (role IN ('detail', 'property')),
		kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'date', 'number')),
		unit TEXT CHECK (unit IS NULL OR (kind = 'number' AND unit != '')),
		position INTEGER CHECK (position IS NULL OR role = 'property'),
		UNIQUE (id, role)
	);

	CREATE TABLE event_type_fields (
		type_id INTEGER NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
		field_id INTEGER NOT NULL REFERENCES fields(id),
		position INTEGER NOT NULL,
		default_value TEXT CHECK (default_value != ''),
		PRIMARY KEY (type_id, field_id)
	);

	CREATE TABLE event_details (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		field_id INTEGER NOT NULL,
		role TEXT NOT NULL DEFAULT 'detail' CHECK (role = 'detail'),
		value TEXT NOT NULL,
		PRIMARY KEY (event_id, field_id),
		FOREIGN KEY (field_id, role) REFERENCES fields(id, role) DEFERRABLE INITIALLY DEFERRED
	);

	-- A field's current value is the row with the latest "since". NULL means "from the
	-- beginning". A row set by an event carries its date and goes with it.
	CREATE TABLE object_attrs (
		id INTEGER PRIMARY KEY,
		object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
		field_id INTEGER NOT NULL,
		role TEXT NOT NULL DEFAULT 'property' CHECK (role = 'property'),
		value TEXT NOT NULL,
		since TEXT,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
		FOREIGN KEY (field_id, role) REFERENCES fields(id, role) DEFERRABLE INITIALLY DEFERRED
	);
	CREATE INDEX object_attrs_object ON object_attrs(object_id, field_id);
`;

export const DIARY_SCHEMA: Schema = {
	version: 9,
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

	${FIELDS}

	CREATE TABLE event_files (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		file_id TEXT NOT NULL REFERENCES files(id),
		position INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (event_id, file_id)
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
		8: (db, dirs) => measureOldImages(db, dirs.photosDir),
		9: `
		ALTER TABLE object_attrs RENAME TO object_attrs_v8;
		DROP INDEX object_attrs_object;
		${FIELDS}

		CREATE TEMP TABLE template_fields AS
		SELECT t.id AS type_id, j.key AS position, j.value ->> 'key' AS name,
			j.value ->> 'target' AS target, nullif(j.value ->> 'default', '') AS default_value
		FROM event_types t, json_each(t.fields) j WHERE j.value ->> 'key' != '';

		-- A name a template sets on the object is a property, even before any event used it so.
		INSERT INTO fields (name, role)
		SELECT name, CASE WHEN name IN (SELECT key FROM object_attrs_v8)
			OR name IN (SELECT name FROM temp.template_fields WHERE target = 'object')
			THEN 'property' ELSE 'detail' END
		FROM (SELECT key AS name FROM object_attrs_v8 UNION SELECT key FROM event_attrs
			UNION SELECT key FROM field_kinds UNION SELECT name FROM temp.template_fields)
		WHERE name != '';

		UPDATE fields SET kind = k.kind, unit = CASE WHEN k.kind = 'number' THEN nullif(trim(k.unit), '') END
		FROM field_kinds k WHERE k.key = fields.name;

		UPDATE fields SET position = o.key
		FROM settings s, json_each(s.value) o
		WHERE s.key = 'propertyOrder' AND o.value = fields.name AND fields.role = 'property';
		DELETE FROM settings WHERE key = 'propertyOrder';

		INSERT OR IGNORE INTO event_type_fields (type_id, field_id, position, default_value)
		SELECT tf.type_id, f.id, tf.position, tf.default_value
		FROM temp.template_fields tf JOIN fields f ON f.name = tf.name
		ORDER BY tf.type_id, tf.position;
		ALTER TABLE event_types DROP COLUMN fields;

		INSERT INTO object_attrs (id, object_id, field_id, value, since, event_id)
		SELECT a.id, a.object_id, f.id, a.value, a.since, a.event_id
		FROM object_attrs_v8 a JOIN fields f ON f.name = a.key ORDER BY a.id;
		INSERT INTO object_attrs (object_id, field_id, value, since, event_id)
		SELECT e.object_id, f.id, a.value, e.date, a.event_id
		FROM event_attrs a JOIN events e ON e.id = a.event_id JOIN fields f ON f.name = a.key
		WHERE f.role = 'property' ORDER BY e.date, e.id;
		INSERT INTO event_details (event_id, field_id, value)
		SELECT a.event_id, f.id, a.value
		FROM event_attrs a JOIN fields f ON f.name = a.key
		WHERE f.role = 'detail' ORDER BY a.rowid;

		DROP TABLE object_attrs_v8;
		DROP TABLE event_attrs;
		DROP TABLE field_kinds;
		DROP TABLE temp.template_fields;
		`
	}
};

export function openDiary(file: string): Db {
	return openDb(file, DIARY_SCHEMA);
}
