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
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('43edeab0-ef69-4cdd-a8a8-14cf8de6164c', '43edeab0-ef69-4cdd-a8a8-14cf8de6164c', 'image/jpeg', 'phal-1.jpg', NULL, '2026-10-30 23:17:11', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('b03966c0-5e4e-440c-94fa-90b7bb53fbb8', 'b03966c0-5e4e-440c-94fa-90b7bb53fbb8', 'image/jpeg', 'umtopfen.jpg', NULL, '2026-10-30 23:17:11', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('660f371c-2361-4290-a6ad-b0c48268bf1c', '660f371c-2361-4290-a6ad-b0c48268bf1c', 'application/pdf', 'rechnung.pdf', NULL, '2026-10-30 23:17:11', NULL, NULL);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('be945875-2288-4106-86fa-7457d0dc7f11', 'be945875-2288-4106-86fa-7457d0dc7f11', 'image/jpeg', 'bluete.jpg', NULL, '2026-10-30 23:17:11', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('685f0694-070e-44c1-8138-35c93e1f0024', '685f0694-070e-44c1-8138-35c93e1f0024', 'video/mp4', 'bluete.mp4', NULL, '2026-10-30 23:17:11', NULL, NULL);
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (1, 'Phalaenopsis weiß', 1, '', 'be945875-2288-4106-86fa-7457d0dc7f11', '2026-10-30 23:17:11');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (2, 'Cattleya', 1, '', NULL, '2026-10-30 23:17:11');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (3, 'Dendrobium', 0, 'Geschenk', NULL, '2026-10-30 23:17:11');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (4, 'Haus', 1, '', NULL, '2026-10-30 23:17:11');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (1, 'Foto dokumentiert', 'Sonstiges', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (2, 'Düngen', 'Pflege', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (3, 'Umtopfen', 'Pflege', 0, 'Nach der Blüte');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (4, 'Standortwechsel', 'Pflege', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (5, 'Gießen', 'Pflege', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (6, 'Kontrolle', 'Haus', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (7, 'Kontrolle', 'Pflege', 0, '');
INSERT INTO event_types (id, name, category, milestone, hint) VALUES (8, 'Blüte', '', 1, '');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (1, 1, 1, '2025-04-12', '', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (2, 1, 2, '2026-03-01', 'volle Dosis', '53133718-7fcd-4bae-9a2d-deca49fc7012', '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (3, 2, 2, '2026-03-01', 'volle Dosis', '53133718-7fcd-4bae-9a2d-deca49fc7012', '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (4, 3, 2, '2026-03-01', 'volle Dosis', '53133718-7fcd-4bae-9a2d-deca49fc7012', '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (5, 1, 3, '2026-03-15', '', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (6, 2, 3, '2026-02-01', '', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (7, 2, 4, '2026-04-01', '', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (8, 3, 5, '2026-01-10', '', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (9, 3, 5, '2026-02-10', '', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (10, 4, 6, '2026-05-02', 'Kellerdecke trocken', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (11, 2, 7, '2026-05-03', '', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (12, 1, 8, '2026-05-20', 'Erste Rispe, 8 Knospen', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (13, 1, 2, '2026-04-01', '', NULL, '2026-10-30 23:17:11');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (14, 2, 2, '2026-04-15', '', NULL, '2026-10-30 23:17:11');
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
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (1, 1, 3, 'property', 'Ostfenster', NULL, NULL);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (2, 1, 4, 'property', 'Rinde', NULL, NULL);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (3, 1, 1, 'property', '2025-04-10', NULL, NULL);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (5, 2, 3, 'property', 'Südfenster', NULL, NULL);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (6, 3, 3, 'property', 'Küche', NULL, NULL);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (7, 1, 4, 'property', 'Bims', '2026-03-15', 5);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (8, 1, 2, 'property', '14', '2026-03-15', 5);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (9, 2, 4, 'property', 'Rinde', '2026-02-01', 6);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (10, 2, 4, 'property', 'Sphagnum', NULL, NULL);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (11, 2, 3, 'property', 'Fensterbank', '2026-04-01', 7);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (12, 3, 7, 'property', 'Regenwasser', '2026-01-10', 8);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (13, 3, 7, 'property', 'Regenwasser', '2026-02-10', 9);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (14, 3, 7, 'property', 'Leitungswasser', '2026-10-30', NULL);
INSERT INTO object_attrs (id, object_id, field_id, role, value, since, event_id) VALUES (15, 2, 3, 'property', 'Wohnzimmer', '2026-10-30', NULL);
INSERT INTO event_files (event_id, file_id, position) VALUES (1, '43edeab0-ef69-4cdd-a8a8-14cf8de6164c', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (5, 'b03966c0-5e4e-440c-94fa-90b7bb53fbb8', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (5, '660f371c-2361-4290-a6ad-b0c48268bf1c', 1);
INSERT INTO event_files (event_id, file_id, position) VALUES (12, 'be945875-2288-4106-86fa-7457d0dc7f11', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (12, '685f0694-070e-44c1-8138-35c93e1f0024', 1);
INSERT INTO settings (key, value) VALUES ('photoTypeId', '1');
INSERT INTO settings (key, value) VALUES ('overviewColumns', '[{"label":"Gedüngt","typeIds":[2]},{"label":"Umgetopft","typeIds":[3]}]');
PRAGMA user_version = 9;
