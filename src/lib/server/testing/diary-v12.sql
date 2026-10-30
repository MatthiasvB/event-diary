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
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
CREATE TABLE property_values (
		id INTEGER PRIMARY KEY,
		object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
		field_id INTEGER NOT NULL,
		role TEXT NOT NULL DEFAULT 'property' CHECK (role = 'property'),
		value TEXT NOT NULL,
		since TEXT,
		event_id INTEGER,
		CHECK (event_id IS NULL OR since IS NULL),
		FOREIGN KEY (field_id, role) REFERENCES fields(id, role) DEFERRABLE INITIALLY DEFERRED,
		FOREIGN KEY (event_id, object_id) REFERENCES event_objects(event_id, object_id)
			ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED
	);
CREATE INDEX property_values_object ON property_values(object_id, field_id);
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
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('9be698d0-303d-4cf5-82c3-63f93c2e8207', '9be698d0-303d-4cf5-82c3-63f93c2e8207', 'image/jpeg', 'phal-1.jpg', NULL, '2026-10-30 23:50:58', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('4dcaf959-8f48-40ef-b256-8edaacec658b', '4dcaf959-8f48-40ef-b256-8edaacec658b', 'image/jpeg', 'umtopfen.jpg', NULL, '2026-10-30 23:50:58', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('4c0a559b-29f0-41c0-8a43-03f717ebbb69', '4c0a559b-29f0-41c0-8a43-03f717ebbb69', 'application/pdf', 'rechnung.pdf', NULL, '2026-10-30 23:50:58', NULL, NULL);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('7f1be3fe-f33f-451f-b197-489be330dfe9', '7f1be3fe-f33f-451f-b197-489be330dfe9', 'image/jpeg', 'bluete.jpg', NULL, '2026-10-30 23:50:58', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('ed0f3f92-4dc8-409e-9808-1509e9be9b26', 'ed0f3f92-4dc8-409e-9808-1509e9be9b26', 'video/mp4', 'bluete.mp4', NULL, '2026-10-30 23:50:58', NULL, NULL);
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (1, 'Phalaenopsis weiß', 1, '', '7f1be3fe-f33f-451f-b197-489be330dfe9', '2026-10-30 23:50:58');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (2, 'Cattleya', 1, '', NULL, '2026-10-30 23:50:58');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (3, 'Dendrobium', 0, 'Geschenk', NULL, '2026-10-30 23:50:58');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (4, 'Haus', 1, '', NULL, '2026-10-30 23:50:58');
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
INSERT INTO events (id, type_id, date, note, created_at) VALUES (1, 1, '2025-04-12', '', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (2, 2, '2026-03-01', 'volle Dosis', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (3, 3, '2026-03-15', '', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (4, 3, '2026-02-01', '', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (5, 4, '2026-04-01', '', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (6, 5, '2026-01-10', '', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (7, 5, '2026-02-10', '', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (8, 6, '2026-05-02', 'Kellerdecke trocken', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (9, 7, '2026-05-03', '', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (10, 8, '2026-05-20', 'Erste Rispe, 8 Knospen', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (11, 2, '2026-04-01', '', '2026-10-30 23:50:58');
INSERT INTO events (id, type_id, date, note, created_at) VALUES (12, 2, '2026-04-15', '', '2026-10-30 23:50:58');
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
INSERT INTO fields (id, name, role, kind, unit, position) VALUES (1, 'Erworben am', 'property', 'date', NULL, NULL);
INSERT INTO fields (id, name, role, kind, unit, position) VALUES (2, 'Topfgröße', 'property', 'number', 'cm', NULL);
INSERT INTO fields (id, name, role, kind, unit, position) VALUES (3, 'Standort', 'property', 'text', NULL, 0);
INSERT INTO fields (id, name, role, kind, unit, position) VALUES (4, 'Substrat', 'property', 'text', NULL, 1);
INSERT INTO fields (id, name, role, kind, unit, position) VALUES (5, 'Menge', 'detail', 'number', 'ml', NULL);
INSERT INTO fields (id, name, role, kind, unit, position) VALUES (6, 'Produkt', 'detail', 'text', NULL, NULL);
INSERT INTO fields (id, name, role, kind, unit, position) VALUES (7, 'Wasser', 'property', 'text', NULL, NULL);
INSERT INTO fields (id, name, role, kind, unit, position) VALUES (8, 'Schädlinge', 'detail', 'text', NULL, NULL);
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
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (1, 1, 3, 'property', 'Ostfenster', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (2, 1, 4, 'property', 'Rinde', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (3, 1, 1, 'property', '2025-04-10', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (5, 2, 3, 'property', 'Südfenster', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (6, 3, 3, 'property', 'Küche', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (7, 1, 4, 'property', 'Bims', NULL, 3);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (8, 1, 2, 'property', '14', NULL, 3);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (9, 2, 4, 'property', 'Rinde', NULL, 4);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (10, 2, 4, 'property', 'Sphagnum', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (11, 2, 3, 'property', 'Fensterbank', NULL, 5);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (12, 3, 7, 'property', 'Regenwasser', NULL, 6);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (13, 3, 7, 'property', 'Regenwasser', NULL, 7);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (14, 3, 7, 'property', 'Leitungswasser', '2026-10-30', NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (15, 2, 3, 'property', 'Wohnzimmer', '2026-10-30', NULL);
INSERT INTO event_files (event_id, file_id, position) VALUES (1, '9be698d0-303d-4cf5-82c3-63f93c2e8207', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (3, '4dcaf959-8f48-40ef-b256-8edaacec658b', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (3, '4c0a559b-29f0-41c0-8a43-03f717ebbb69', 1);
INSERT INTO event_files (event_id, file_id, position) VALUES (10, '7f1be3fe-f33f-451f-b197-489be330dfe9', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (10, 'ed0f3f92-4dc8-409e-9808-1509e9be9b26', 1);
INSERT INTO overview_columns (id, label, position) VALUES (1, 'Gedüngt', 0);
INSERT INTO overview_columns (id, label, position) VALUES (2, 'Umgetopft', 1);
INSERT INTO overview_column_types (column_id, type_id) VALUES (1, 2);
INSERT INTO overview_column_types (column_id, type_id) VALUES (2, 3);
PRAGMA user_version = 12;
