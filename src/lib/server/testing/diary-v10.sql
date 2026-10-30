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
CREATE UNIQUE INDEX events_id_object ON events(id, object_id);
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
		FOREIGN KEY (event_id, object_id) REFERENCES events(id, object_id)
			ON DELETE CASCADE ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED
	);
CREATE INDEX property_values_object ON property_values(object_id, field_id);
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
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('26876c32-1361-4302-b016-af41f9b47bfc', '26876c32-1361-4302-b016-af41f9b47bfc', 'image/jpeg', 'phal-1.jpg', NULL, '2026-10-30 23:28:11', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('b3ff1427-da90-4f09-8ec0-37eea482e978', 'b3ff1427-da90-4f09-8ec0-37eea482e978', 'image/jpeg', 'umtopfen.jpg', NULL, '2026-10-30 23:28:11', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('fd8335f5-03df-4d71-863f-4a6a7c39597f', 'fd8335f5-03df-4d71-863f-4a6a7c39597f', 'application/pdf', 'rechnung.pdf', NULL, '2026-10-30 23:28:11', NULL, NULL);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('c8b0d645-e92f-4e28-9ce1-66f79fe481a9', 'c8b0d645-e92f-4e28-9ce1-66f79fe481a9', 'image/jpeg', 'bluete.jpg', NULL, '2026-10-30 23:28:11', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('4dcd28ed-38f4-4f87-b14b-a5842f601f4a', '4dcd28ed-38f4-4f87-b14b-a5842f601f4a', 'video/mp4', 'bluete.mp4', NULL, '2026-10-30 23:28:11', NULL, NULL);
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (1, 'Phalaenopsis weiß', 1, '', 'c8b0d645-e92f-4e28-9ce1-66f79fe481a9', '2026-10-30 23:28:11');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (2, 'Cattleya', 1, '', NULL, '2026-10-30 23:28:11');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (3, 'Dendrobium', 0, 'Geschenk', NULL, '2026-10-30 23:28:11');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (4, 'Haus', 1, '', NULL, '2026-10-30 23:28:11');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (1, 'Foto dokumentiert', 'Sonstiges', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (2, 'Düngen', 'Pflege', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (3, 'Umtopfen', 'Pflege', 0, 'Nach der Blüte');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (4, 'Standortwechsel', 'Pflege', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (5, 'Gießen', 'Pflege', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (6, 'Kontrolle', 'Haus', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (7, 'Kontrolle', 'Pflege', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (8, 'Blüte', '', 1, '');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (1, 1, 1, '2025-04-12', '', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (2, 1, 2, '2026-03-01', 'volle Dosis', 'c185359e-e967-465c-a16a-4210d510a7e3', '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (3, 2, 2, '2026-03-01', 'volle Dosis', 'c185359e-e967-465c-a16a-4210d510a7e3', '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (4, 3, 2, '2026-03-01', 'volle Dosis', 'c185359e-e967-465c-a16a-4210d510a7e3', '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (5, 1, 3, '2026-03-15', '', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (6, 2, 3, '2026-02-01', '', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (7, 2, 4, '2026-04-01', '', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (8, 3, 5, '2026-01-10', '', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (9, 3, 5, '2026-02-10', '', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (10, 4, 6, '2026-05-02', 'Kellerdecke trocken', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (11, 2, 7, '2026-05-03', '', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (12, 1, 8, '2026-05-20', 'Erste Rispe, 8 Knospen', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (13, 1, 2, '2026-04-01', '', NULL, '2026-10-30 23:28:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (14, 2, 2, '2026-04-15', '', NULL, '2026-10-30 23:28:11');
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
INSERT INTO event_details (event_id, field_id, role, value) VALUES (11, 8, 'detail', 'keine');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (13, 6, 'detail', 'Orchideendünger');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (13, 5, 'detail', '2');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (14, 6, 'detail', 'Orchideendünger');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (2, 6, 'detail', 'Orchideendünger');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (2, 5, 'detail', '2.5');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (3, 6, 'detail', 'Orchideendünger');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (3, 5, 'detail', '2.5');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (4, 6, 'detail', 'Orchideendünger');
INSERT INTO event_details (event_id, field_id, role, value) VALUES (4, 5, 'detail', '2.5');
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (1, 1, 3, 'property', 'Ostfenster', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (2, 1, 4, 'property', 'Rinde', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (3, 1, 1, 'property', '2025-04-10', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (5, 2, 3, 'property', 'Südfenster', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (6, 3, 3, 'property', 'Küche', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (7, 1, 4, 'property', 'Bims', NULL, 5);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (8, 1, 2, 'property', '14', NULL, 5);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (9, 2, 4, 'property', 'Rinde', NULL, 6);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (10, 2, 4, 'property', 'Sphagnum', NULL, NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (11, 2, 3, 'property', 'Fensterbank', NULL, 7);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (12, 3, 7, 'property', 'Regenwasser', NULL, 8);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (13, 3, 7, 'property', 'Regenwasser', NULL, 9);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (14, 3, 7, 'property', 'Leitungswasser', '2026-10-30', NULL);
INSERT INTO property_values (id, object_id, field_id, role, value, since, event_id) VALUES (15, 2, 3, 'property', 'Wohnzimmer', '2026-10-30', NULL);
INSERT INTO event_files (event_id, file_id, position) VALUES (1, '26876c32-1361-4302-b016-af41f9b47bfc', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (5, 'b3ff1427-da90-4f09-8ec0-37eea482e978', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (5, 'fd8335f5-03df-4d71-863f-4a6a7c39597f', 1);
INSERT INTO event_files (event_id, file_id, position) VALUES (12, 'c8b0d645-e92f-4e28-9ce1-66f79fe481a9', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (12, '4dcd28ed-38f4-4f87-b14b-a5842f601f4a', 1);
INSERT INTO settings (key, value) VALUES ('photoTypeId', '1');
INSERT INTO settings (key, value) VALUES ('overviewColumns', '[{"label":"Gedüngt","typeIds":[2]},{"label":"Umgetopft","typeIds":[3]}]');
PRAGMA user_version = 10;
