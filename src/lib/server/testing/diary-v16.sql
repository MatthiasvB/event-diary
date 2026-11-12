PRAGMA foreign_keys = OFF;
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
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		listed INTEGER NOT NULL DEFAULT 1 CHECK (listed IN (0, 1)),
		stock INTEGER NOT NULL DEFAULT 0 CHECK (stock IN (0, 1)),
		UNIQUE (id, stock)
	);
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
CREATE TABLE fields (
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
CREATE TABLE property_values (
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
		CONSTRAINT association_to_itself CHECK (target_id != object_id),
		CHECK (event_id IS NULL OR since IS NULL),
		FOREIGN KEY (field_id, role, value_type) REFERENCES fields(id, role, value_type)
			DEFERRABLE INITIALLY DEFERRED,
		FOREIGN KEY (object_id, associated_stock) REFERENCES objects(id, stock) ON DELETE CASCADE,
		FOREIGN KEY (target_id, associated_stock) REFERENCES objects(id, stock),
		FOREIGN KEY (event_id, object_id) REFERENCES event_objects(event_id, object_id)
			ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED
	);
CREATE INDEX property_values_object ON property_values(object_id, field_id);
CREATE INDEX property_values_target ON property_values(target_id);
CREATE TRIGGER association_insert AFTER INSERT ON property_values
	WHEN NEW.target_id IS NOT NULL BEGIN 
	SELECT RAISE(ABORT, 'association cycle') WHERE EXISTS (
		WITH RECURSIVE current (object_id, target_id) AS (
			SELECT a.object_id, a.target_id FROM property_values a
			WHERE a.field_id = NEW.field_id AND a.id = (
				SELECT b.id FROM property_values b LEFT JOIN events e ON e.id = b.event_id
				WHERE b.object_id = a.object_id AND b.field_id = a.field_id
				ORDER BY coalesce(e.date, b.since, '') DESC, b.id DESC LIMIT 1)
		), reached (id) AS (
			SELECT target_id FROM current WHERE object_id = NEW.object_id
			UNION SELECT c.target_id FROM current c JOIN reached r ON c.object_id = r.id
		)
		SELECT 1 FROM reached WHERE id = NEW.object_id
	); END;
CREATE TRIGGER association_update AFTER UPDATE OF target_id ON property_values
	WHEN NEW.target_id IS NOT NULL BEGIN 
	SELECT RAISE(ABORT, 'association cycle') WHERE EXISTS (
		WITH RECURSIVE current (object_id, target_id) AS (
			SELECT a.object_id, a.target_id FROM property_values a
			WHERE a.field_id = NEW.field_id AND a.id = (
				SELECT b.id FROM property_values b LEFT JOIN events e ON e.id = b.event_id
				WHERE b.object_id = a.object_id AND b.field_id = a.field_id
				ORDER BY coalesce(e.date, b.since, '') DESC, b.id DESC LIMIT 1)
		), reached (id) AS (
			SELECT target_id FROM current WHERE object_id = NEW.object_id
			UNION SELECT c.target_id FROM current c JOIN reached r ON c.object_id = r.id
		)
		SELECT 1 FROM reached WHERE id = NEW.object_id
	); END;
CREATE TRIGGER association_delete AFTER DELETE ON property_values
	WHEN OLD.target_id IS NOT NULL BEGIN 
	SELECT RAISE(ABORT, 'association cycle') WHERE EXISTS (
		WITH RECURSIVE current (object_id, target_id) AS (
			SELECT a.object_id, a.target_id FROM property_values a
			WHERE a.field_id = OLD.field_id AND a.id = (
				SELECT b.id FROM property_values b LEFT JOIN events e ON e.id = b.event_id
				WHERE b.object_id = a.object_id AND b.field_id = a.field_id
				ORDER BY coalesce(e.date, b.since, '') DESC, b.id DESC LIMIT 1)
		), reached (id) AS (
			SELECT target_id FROM current WHERE object_id = OLD.object_id
			UNION SELECT c.target_id FROM current c JOIN reached r ON c.object_id = r.id
		)
		SELECT 1 FROM reached WHERE id = OLD.object_id
	); END;
CREATE TABLE unit_moves (
		id INTEGER PRIMARY KEY,
		object_id INTEGER NOT NULL,
		kind TEXT NOT NULL CHECK (kind IN ('add', 'remove', 'move')),
		quantity INTEGER NOT NULL CHECK (quantity > 0),
		from_id INTEGER,
		to_id INTEGER,
		since TEXT,
		event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
		stock INTEGER GENERATED ALWAYS AS (1) STORED,
		holder_stock INTEGER GENERATED ALWAYS AS (0) STORED,
		CHECK (CASE kind
			WHEN 'add' THEN from_id IS NULL
			WHEN 'remove' THEN to_id IS NULL
			ELSE from_id IS NOT to_id END),
		CHECK (event_id IS NULL OR since IS NULL),
		FOREIGN KEY (object_id, stock) REFERENCES objects(id, stock) ON DELETE CASCADE,
		FOREIGN KEY (from_id, holder_stock) REFERENCES objects(id, stock),
		FOREIGN KEY (to_id, holder_stock) REFERENCES objects(id, stock)
	);
CREATE INDEX unit_moves_object ON unit_moves(object_id);
CREATE INDEX unit_moves_from ON unit_moves(from_id);
CREATE INDEX unit_moves_to ON unit_moves(to_id);
CREATE INDEX unit_moves_event ON unit_moves(event_id);
CREATE TABLE event_files (
		event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
		file_id TEXT NOT NULL REFERENCES files(id),
		position INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (event_id, file_id)
	);
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
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('313bfe47-032a-4500-92ba-894edbcf8f4e', '313bfe47-032a-4500-92ba-894edbcf8f4e', 'image/jpeg', 'phal-1.jpg', NULL, '2026-11-12 22:16:11', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('f9e76db7-50e9-4fab-9d30-82443947a13b', 'f9e76db7-50e9-4fab-9d30-82443947a13b', 'image/jpeg', 'umtopfen.jpg', NULL, '2026-11-12 22:16:11', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('ff3110eb-68f0-4732-b0db-50c5699cdc24', 'ff3110eb-68f0-4732-b0db-50c5699cdc24', 'application/pdf', 'rechnung.pdf', NULL, '2026-11-12 22:16:11', NULL, NULL);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('5f80d666-96ab-42c0-a958-cb4611980f56', '5f80d666-96ab-42c0-a958-cb4611980f56', 'image/jpeg', 'bluete.jpg', NULL, '2026-11-12 22:16:11', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('b676d474-3745-470e-8e90-0a526b541ef2', 'b676d474-3745-470e-8e90-0a526b541ef2', 'video/mp4', 'bluete.mp4', NULL, '2026-11-12 22:16:11', NULL, NULL);
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at, listed, stock) VALUES (1, 'Phalaenopsis weiß', 1, '', '5f80d666-96ab-42c0-a958-cb4611980f56', '2026-11-12 22:16:11', 1, 0);
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at, listed, stock) VALUES (2, 'Cattleya', 1, '', NULL, '2026-11-12 22:16:11', 1, 0);
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at, listed, stock) VALUES (3, 'Dendrobium', 0, 'Geschenk', NULL, '2026-11-12 22:16:11', 1, 0);
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at, listed, stock) VALUES (4, 'Haus', 1, '', NULL, '2026-11-12 22:16:11', 1, 0);
INSERT INTO categories (id, name) VALUES (1, 'Sonstiges');
INSERT INTO categories (id, name) VALUES (2, 'Pflege');
INSERT INTO categories (id, name) VALUES (3, 'Haus');
INSERT INTO event_types (id, name, category_id, milestone, hint, photo_default) VALUES (1, 'Foto dokumentiert', 1, 0, '', 1);
INSERT INTO event_types (id, name, category_id, milestone, hint, photo_default) VALUES (2, 'Düngen', 2, 0, '', 0);
INSERT INTO event_types (id, name, category_id, milestone, hint, photo_default) VALUES (3, 'Umtopfen', 2, 0, 'Nach der Blüte', 0);
INSERT INTO event_types (id, name, category_id, milestone, hint, photo_default) VALUES (4, 'Standortwechsel', 2, 0, '', 0);
INSERT INTO event_types (id, name, category_id, milestone, hint, photo_default) VALUES (5, 'Gießen', 2, 0, '', 0);
INSERT INTO event_types (id, name, category_id, milestone, hint, photo_default) VALUES (6, 'Kontrolle', 3, 0, '', 0);
INSERT INTO event_types (id, name, category_id, milestone, hint, photo_default) VALUES (7, 'Kontrolle', 2, 0, '', 0);
INSERT INTO event_types (id, name, category_id, milestone, hint, photo_default) VALUES (8, 'Blüte', NULL, 1, '', 0);
INSERT INTO events (id, type_id, date, note, created_at) VALUES (1, 1, '2025-04-12', '', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (2, 2, '2026-03-01', 'volle Dosis', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (3, 3, '2026-03-15', '', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (4, 3, '2026-02-01', '', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (5, 4, '2026-04-01', '', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (6, 5, '2026-01-10', '', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (7, 5, '2026-02-10', '', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (8, 6, '2026-05-02', 'Kellerdecke trocken', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (9, 7, '2026-05-03', '', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (10, 8, '2026-05-20', 'Erste Rispe, 8 Knospen', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (11, 2, '2026-04-01', '', '2026-11-12 22:16:11');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (12, 2, '2026-04-15', '', '2026-11-12 22:16:11');
INSERT INTO event_objects (event_id, object_id) VALUES (1, 1);
INSERT INTO event_objects (event_id, object_id) VALUES (2, 1);
INSERT INTO event_objects (event_id, object_id) VALUES (2, 2);
INSERT INTO event_objects (event_id, object_id) VALUES (2, 3);
INSERT INTO event_objects (event_id, object_id) VALUES (3, 1);
INSERT INTO event_objects (event_id, object_id) VALUES (4, 2);
INSERT INTO event_objects (event_id, object_id) VALUES (5, 2);
INSERT INTO event_objects (event_id, object_id) VALUES (6, 3);
INSERT INTO event_objects (event_id, object_id) VALUES (7, 3);
INSERT INTO event_objects (event_id, object_id) VALUES (8, 4);
INSERT INTO event_objects (event_id, object_id) VALUES (9, 2);
INSERT INTO event_objects (event_id, object_id) VALUES (10, 1);
INSERT INTO event_objects (event_id, object_id) VALUES (11, 1);
INSERT INTO event_objects (event_id, object_id) VALUES (12, 2);
INSERT INTO fields (id, name, role, kind, unit, position, suggest_values) VALUES (1, 'Erworben am', 'property', 'date', NULL, NULL, 1);
INSERT INTO fields (id, name, role, kind, unit, position, suggest_values) VALUES (2, 'Topfgröße', 'property', 'number', 'cm', NULL, 1);
INSERT INTO fields (id, name, role, kind, unit, position, suggest_values) VALUES (3, 'Standort', 'property', 'text', NULL, 0, 1);
INSERT INTO fields (id, name, role, kind, unit, position, suggest_values) VALUES (4, 'Substrat', 'property', 'text', NULL, 1, 1);
INSERT INTO fields (id, name, role, kind, unit, position, suggest_values) VALUES (5, 'Menge', 'detail', 'number', 'ml', NULL, 1);
INSERT INTO fields (id, name, role, kind, unit, position, suggest_values) VALUES (6, 'Produkt', 'detail', 'text', NULL, NULL, 1);
INSERT INTO fields (id, name, role, kind, unit, position, suggest_values) VALUES (7, 'Wasser', 'property', 'text', NULL, NULL, 1);
INSERT INTO fields (id, name, role, kind, unit, position, suggest_values) VALUES (8, 'Schädlinge', 'detail', 'text', NULL, NULL, 1);
INSERT INTO event_type_fields (type_id, field_id, position, default_value) VALUES (2, 6, 0, NULL);
INSERT INTO event_type_fields (type_id, field_id, position, default_value) VALUES (2, 5, 1, NULL);
INSERT INTO event_type_fields (type_id, field_id, position, default_value) VALUES (4, 3, 0, NULL);
INSERT INTO event_type_fields (type_id, field_id, position, default_value) VALUES (5, 7, 0, NULL);
INSERT INTO event_type_fields (type_id, field_id, position, default_value) VALUES (7, 8, 0, NULL);
INSERT INTO event_type_fields (type_id, field_id, position, default_value) VALUES (3, 4, 0, NULL);
INSERT INTO event_type_fields (type_id, field_id, position, default_value) VALUES (3, 2, 1, '14');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (9, 8, 'detail', 'keine');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (11, 6, 'detail', 'Orchideendünger');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (11, 5, 'detail', '2');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (12, 6, 'detail', 'Orchideendünger');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (2, 6, 'detail', 'Orchideendünger');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (2, 5, 'detail', '2.5');
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (1, 1, 3, 'property', 'Ostfenster', NULL, NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (2, 1, 4, 'property', 'Rinde', NULL, NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (3, 1, 1, 'property', '2025-04-10', NULL, NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (5, 2, 3, 'property', 'Südfenster', NULL, NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (6, 3, 3, 'property', 'Küche', NULL, NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (7, 1, 4, 'property', 'Bims', NULL, NULL, 3);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (8, 1, 2, 'property', '14', NULL, NULL, 3);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (9, 2, 4, 'property', 'Rinde', NULL, NULL, 4);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (10, 2, 4, 'property', 'Sphagnum', NULL, NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (11, 2, 3, 'property', 'Fensterbank', NULL, NULL, 5);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (12, 3, 7, 'property', 'Regenwasser', NULL, NULL, 6);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (13, 3, 7, 'property', 'Regenwasser', NULL, NULL, 7);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (14, 3, 7, 'property', 'Leitungswasser', NULL, '2026-10-30', NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, target_id, since, event_id) VALUES (15, 2, 3, 'property', 'Wohnzimmer', NULL, '2026-10-30', NULL);
INSERT INTO event_files (event_id, file_id, position) VALUES (1, '313bfe47-032a-4500-92ba-894edbcf8f4e', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (3, 'f9e76db7-50e9-4fab-9d30-82443947a13b', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (3, 'ff3110eb-68f0-4732-b0db-50c5699cdc24', 1);
INSERT INTO event_files (event_id, file_id, position) VALUES (10, '5f80d666-96ab-42c0-a958-cb4611980f56', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (10, 'b676d474-3745-470e-8e90-0a526b541ef2', 1);
INSERT INTO overview_columns (id, label, position) VALUES (1, 'Gedüngt', 0);
INSERT INTO overview_columns (id, label, position) VALUES (2, 'Umgetopft', 1);
INSERT INTO overview_column_types (column_id, type_id) VALUES (1, 2);
INSERT INTO overview_column_types (column_id, type_id) VALUES (2, 3);
PRAGMA user_version = 16;
