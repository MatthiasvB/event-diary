import { openDb, type Db, type Schema } from './db.ts';

// See docs/adr/0001-fields.md for the role columns, and docs/adr/0006-associations.md for
// value_type.
const FIELDS_TABLE = (name: string) => `
	CREATE TABLE ${name} (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE CHECK (name != ''),
		role TEXT NOT NULL CHECK (role IN ('detail', 'property')),
		kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'date', 'number', 'object')),
		unit TEXT CHECK (unit IS NULL OR (kind = 'number' AND unit != '')),
		position INTEGER CHECK (position IS NULL OR role = 'property'),
		suggest_values INTEGER NOT NULL DEFAULT 1 CHECK (suggest_values IN (0, 1)),
		value_type TEXT GENERATED ALWAYS AS (iif(kind = 'object', 'object', 'text')) STORED,
		CHECK (kind != 'object' OR role = 'property'),
		UNIQUE (id, role),
		UNIQUE (id, role, value_type)
	);`;

const FIELDS = `
	${FIELDS_TABLE('fields')}

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
`;

// A value without event and date is the initial one. A value with a date is a correction,
// and one with an event changes the property on the event's date.
const EVENTS = `
	CREATE TABLE events (
		id INTEGER PRIMARY KEY,
		type_id INTEGER NOT NULL REFERENCES event_types(id),
		date TEXT NOT NULL,
		note TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX events_type ON events(type_id, date);
	CREATE INDEX events_date ON events(date);

	CREATE TABLE event_objects (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
		PRIMARY KEY (event_id, object_id)
	);
	CREATE INDEX event_objects_object ON event_objects(object_id, event_id);

	CREATE TRIGGER events_without_objects AFTER DELETE ON event_objects
	WHEN NOT EXISTS (SELECT 1 FROM event_objects WHERE event_id = old.event_id)
	BEGIN
		DELETE FROM events WHERE id = old.event_id;
	END;
`;

export const ASSOCIATION_CYCLE = 'association cycle';
export const ASSOCIATION_TO_ITSELF = 'association_to_itself';

// An association's value is the object it points to, in target_id. See
// docs/adr/0007-stock.md for associated_stock.
const PROPERTY_VALUES_TABLE = (name: string) => `
	CREATE TABLE ${name} (
		id INTEGER PRIMARY KEY,
		object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
		field_id INTEGER NOT NULL,
		role TEXT NOT NULL DEFAULT 'property' CHECK (role = 'property'),
		value TEXT,
		target_id INTEGER,
		value_type TEXT GENERATED ALWAYS AS (iif(target_id IS NULL, 'text', 'object')) STORED,
		associated_stock INTEGER GENERATED ALWAYS AS (iif(target_id IS NULL, NULL, 0)) STORED,
		since TEXT,
		event_id INTEGER,
		CHECK ((value IS NULL) != (target_id IS NULL)),
		CONSTRAINT ${ASSOCIATION_TO_ITSELF} CHECK (target_id != object_id),
		CHECK (event_id IS NULL OR since IS NULL),
		FOREIGN KEY (field_id, role, value_type) REFERENCES fields(id, role, value_type)
			DEFERRABLE INITIALLY DEFERRED,
		FOREIGN KEY (object_id, associated_stock) REFERENCES objects(id, stock) ON DELETE CASCADE,
		FOREIGN KEY (target_id, associated_stock) REFERENCES objects(id, stock),
		FOREIGN KEY (event_id, object_id) REFERENCES event_objects(event_id, object_id)
			ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED
	);`;

// Following an association from the changed object must not lead back to it. Only the
// current values count, the last of each object in the order of their dates.
const noCycleFrom = (row: 'NEW' | 'OLD') => `
	SELECT RAISE(ABORT, '${ASSOCIATION_CYCLE}') WHERE EXISTS (
		WITH RECURSIVE current (object_id, target_id) AS (
			SELECT a.object_id, a.target_id FROM property_values a
			WHERE a.field_id = ${row}.field_id AND a.id = (
				SELECT b.id FROM property_values b LEFT JOIN events e ON e.id = b.event_id
				WHERE b.object_id = a.object_id AND b.field_id = a.field_id
				ORDER BY coalesce(e.date, b.since, '') DESC, b.id DESC LIMIT 1)
		), reached (id) AS (
			SELECT target_id FROM current WHERE object_id = ${row}.object_id
			UNION SELECT c.target_id FROM current c JOIN reached r ON c.object_id = r.id
		)
		SELECT 1 FROM reached WHERE id = ${row}.object_id
	);`;

const PROPERTY_VALUES_INDEXES_AND_TRIGGERS = `
	CREATE INDEX property_values_object ON property_values(object_id, field_id);
	CREATE INDEX property_values_target ON property_values(target_id);
	CREATE TRIGGER association_insert AFTER INSERT ON property_values
	WHEN NEW.target_id IS NOT NULL BEGIN ${noCycleFrom('NEW')} END;
	CREATE TRIGGER association_update AFTER UPDATE OF target_id ON property_values
	WHEN NEW.target_id IS NOT NULL BEGIN ${noCycleFrom('NEW')} END;
	CREATE TRIGGER association_delete AFTER DELETE ON property_values
	WHEN OLD.target_id IS NOT NULL BEGIN ${noCycleFrom('OLD')} END;
`;

const PROPERTY_VALUES = `
	${PROPERTY_VALUES_TABLE('property_values')}
	${PROPERTY_VALUES_INDEXES_AND_TRIGGERS}
`;

// See docs/adr/0007-stock.md.
const OBJECTS_TABLE = (name: string) => `
	CREATE TABLE ${name} (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1,
		notes TEXT NOT NULL DEFAULT '',
		cover_photo_id TEXT REFERENCES files(id) ON DELETE SET NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		listed INTEGER NOT NULL DEFAULT 1 CHECK (listed IN (0, 1)),
		stock_field_id INTEGER,
		stock INTEGER GENERATED ALWAYS AS (stock_field_id IS NOT NULL) STORED,
		stock_field_role TEXT GENERATED ALWAYS AS ('property') STORED,
		stock_field_type TEXT GENERATED ALWAYS AS ('object') STORED,
		UNIQUE (id, stock),
		FOREIGN KEY (stock_field_id, stock_field_role, stock_field_type)
			REFERENCES fields(id, role, value_type) DEFERRABLE INITIALLY DEFERRED
	);`;

// A move without event and date is where units were from the start, like an initial value.
const UNIT_MOVES = `
	CREATE TABLE unit_moves (
		id INTEGER PRIMARY KEY,
		object_id INTEGER NOT NULL,
		quantity INTEGER NOT NULL CHECK (quantity > 0),
		from_id INTEGER,
		to_id INTEGER,
		since TEXT,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
		stock INTEGER GENERATED ALWAYS AS (1) STORED,
		holder_stock INTEGER GENERATED ALWAYS AS (0) STORED,
		CHECK (from_id IS NOT to_id),
		CHECK (event_id IS NULL OR since IS NULL),
		FOREIGN KEY (object_id, stock) REFERENCES objects(id, stock) ON DELETE CASCADE,
		FOREIGN KEY (from_id, holder_stock) REFERENCES objects(id, stock),
		FOREIGN KEY (to_id, holder_stock) REFERENCES objects(id, stock)
	);
	CREATE INDEX unit_moves_object ON unit_moves(object_id);
	CREATE INDEX unit_moves_from ON unit_moves(from_id);
	CREATE INDEX unit_moves_to ON unit_moves(to_id);
	CREATE INDEX unit_moves_event ON unit_moves(event_id);
`;

const EVENT_TYPES = `
	CREATE TABLE categories (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE CHECK (name != '')
	);

	CREATE TABLE event_types (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		category_id INTEGER REFERENCES categories(id),
		milestone INTEGER NOT NULL DEFAULT 0,
		hint TEXT NOT NULL DEFAULT '',
		photo_default INTEGER NOT NULL DEFAULT 0 CHECK (photo_default IN (0, 1))
	);
	CREATE UNIQUE INDEX event_types_name ON event_types(name, ifnull(category_id, 0));
	CREATE UNIQUE INDEX event_types_photo ON event_types(photo_default) WHERE photo_default;

	CREATE TRIGGER categories_unused_on_delete AFTER DELETE ON event_types
	BEGIN
		DELETE FROM categories WHERE id = old.category_id
			AND NOT EXISTS (SELECT 1 FROM event_types WHERE category_id = old.category_id);
	END;
	CREATE TRIGGER categories_unused_on_update AFTER UPDATE OF category_id ON event_types
	BEGIN
		DELETE FROM categories WHERE id = old.category_id
			AND NOT EXISTS (SELECT 1 FROM event_types WHERE category_id = old.category_id);
	END;
`;

const OVERVIEW_COLUMNS = `
	CREATE TABLE overview_columns (
		id INTEGER PRIMARY KEY,
		label TEXT NOT NULL CHECK (label != ''),
		position INTEGER NOT NULL
	);

	CREATE TABLE overview_column_types (
		column_id INTEGER NOT NULL REFERENCES overview_columns(id) ON DELETE CASCADE,
		type_id INTEGER NOT NULL REFERENCES event_types(id) ON DELETE CASCADE,
		PRIMARY KEY (column_id, type_id)
	);
`;

export const DIARY_SCHEMA: Schema = {
	version: 15,
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

	${OBJECTS_TABLE('objects')}

	${EVENT_TYPES}

	${EVENTS}

	${FIELDS}
	${PROPERTY_VALUES}
	${UNIT_MOVES}

	CREATE TABLE event_files (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		file_id TEXT NOT NULL REFERENCES files(id),
		position INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (event_id, file_id)
	);

	${OVERVIEW_COLUMNS}
	`,
	migrations: {
		13: `
		ALTER TABLE fields ADD COLUMN
			suggest_values INTEGER NOT NULL DEFAULT 1 CHECK (suggest_values IN (0, 1));
		`,
		14: `
		ALTER TABLE objects ADD COLUMN listed INTEGER NOT NULL DEFAULT 1 CHECK (listed IN (0, 1));

		${FIELDS_TABLE('fields_14')}
		INSERT INTO fields_14 (id, name, role, kind, unit, position, suggest_values)
		SELECT id, name, role, kind, unit, position, suggest_values FROM fields;
		DROP TABLE fields;
		ALTER TABLE fields_14 RENAME TO fields;

		CREATE TABLE property_values_14 (
			id INTEGER PRIMARY KEY,
			object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
			field_id INTEGER NOT NULL,
			role TEXT NOT NULL DEFAULT 'property' CHECK (role = 'property'),
			value TEXT,
			target_id INTEGER REFERENCES objects(id),
			value_type TEXT GENERATED ALWAYS AS (iif(target_id IS NULL, 'text', 'object')) STORED,
			since TEXT,
			event_id INTEGER,
			CHECK ((value IS NULL) != (target_id IS NULL)),
			CONSTRAINT ${ASSOCIATION_TO_ITSELF} CHECK (target_id != object_id),
			CHECK (event_id IS NULL OR since IS NULL),
			FOREIGN KEY (field_id, role, value_type) REFERENCES fields(id, role, value_type)
				DEFERRABLE INITIALLY DEFERRED,
			FOREIGN KEY (event_id, object_id) REFERENCES event_objects(event_id, object_id)
				ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED
		);
		INSERT INTO property_values_14 (id, object_id, field_id, role, value, since, event_id)
		SELECT id, object_id, field_id, role, value, since, event_id FROM property_values;
		DROP TABLE property_values;
		ALTER TABLE property_values_14 RENAME TO property_values;
		${PROPERTY_VALUES_INDEXES_AND_TRIGGERS}
		`,
		15: `
		${OBJECTS_TABLE('objects_15')}
		INSERT INTO objects_15 (id, name, active, notes, cover_photo_id, created_at, listed)
		SELECT id, name, active, notes, cover_photo_id, created_at, listed FROM objects;
		DROP TABLE objects;
		ALTER TABLE objects_15 RENAME TO objects;

		${PROPERTY_VALUES_TABLE('property_values_15')}
		INSERT INTO property_values_15
			(id, object_id, field_id, role, value, target_id, since, event_id)
		SELECT id, object_id, field_id, role, value, target_id, since, event_id FROM property_values;
		DROP TABLE property_values;
		ALTER TABLE property_values_15 RENAME TO property_values;
		${PROPERTY_VALUES_INDEXES_AND_TRIGGERS}

		${UNIT_MOVES}
		`
	}
};

export function openDiary(file: string): Db {
	return openDb(file, DIARY_SCHEMA);
}
