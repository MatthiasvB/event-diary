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
CREATE TABLE field_kinds (
		key TEXT PRIMARY KEY,
		kind TEXT NOT NULL,
		unit TEXT NOT NULL DEFAULT ''
	);
CREATE TABLE settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL             -- JSON
	);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('7e79fcb2-7b8e-46dd-bf6a-36716fc43507', '7e79fcb2-7b8e-46dd-bf6a-36716fc43507', 'image/jpeg', 'phal-1.jpg', NULL, '2026-10-30 08:50:42', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('0e69a8e2-a28f-4189-8d58-42a4dd55bcc0', '0e69a8e2-a28f-4189-8d58-42a4dd55bcc0', 'image/jpeg', 'umtopfen.jpg', NULL, '2026-10-30 08:50:42', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('d70fa074-a56d-436e-8d0f-36e72a78321c', 'd70fa074-a56d-436e-8d0f-36e72a78321c', 'application/pdf', 'rechnung.pdf', NULL, '2026-10-30 08:50:42', NULL, NULL);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('fe51da47-bfdb-4150-958e-4ab3f5e7975b', 'fe51da47-bfdb-4150-958e-4ab3f5e7975b', 'image/jpeg', 'bluete.jpg', NULL, '2026-10-30 08:50:42', 3000, 2250);
INSERT INTO files (id, file, mime, original_name, taken_at, created_at, width, height) VALUES ('089c2807-9fca-4741-996b-5fb13d2cee3e', '089c2807-9fca-4741-996b-5fb13d2cee3e', 'video/mp4', 'bluete.mp4', NULL, '2026-10-30 08:50:42', NULL, NULL);
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (1, 'Phalaenopsis weiß', 1, '', 'fe51da47-bfdb-4150-958e-4ab3f5e7975b', '2026-10-30 08:50:42');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (2, 'Cattleya', 1, '', NULL, '2026-10-30 08:50:42');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (3, 'Dendrobium', 0, 'Geschenk', NULL, '2026-10-30 08:50:42');
INSERT INTO objects (id, name, active, notes, cover_photo_id, created_at) VALUES (4, 'Haus', 1, '', NULL, '2026-10-30 08:50:42');
INSERT INTO event_types (id, name, category, milestone, hint, fields) VALUES (1, 'Foto dokumentiert', 'Sonstiges', 0, '', '[]');
INSERT INTO event_types (id, name, category, milestone, hint, fields) VALUES (2, 'Düngen', 'Pflege', 0, '', '[{"key":"Produkt","target":"event"},{"key":"Menge","target":"event"}]');
INSERT INTO event_types (id, name, category, milestone, hint, fields) VALUES (3, 'Umtopfen', 'Pflege', 0, 'Nach der Blüte', '[{"key":"Substrat","target":"object"},{"key":"Topfgröße","target":"object","default":"14"}]');
INSERT INTO event_types (id, name, category, milestone, hint, fields) VALUES (4, 'Standortwechsel', 'Pflege', 0, '', '[{"key":"Standort","target":"object"}]');
INSERT INTO event_types (id, name, category, milestone, hint, fields) VALUES (5, 'Gießen', 'Pflege', 0, '', '[{"key":"Wasser","target":"object"}]');
INSERT INTO event_types (id, name, category, milestone, hint, fields) VALUES (6, 'Kontrolle', 'Haus', 0, '', '[]');
INSERT INTO event_types (id, name, category, milestone, hint, fields) VALUES (7, 'Kontrolle', 'Pflege', 0, '', '[{"key":"Schädlinge","target":"event"}]');
INSERT INTO event_types (id, name, category, milestone, hint, fields) VALUES (8, 'Blüte', '', 1, '', '[]');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (1, 1, 1, '2025-04-12', '', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (2, 1, 2, '2026-03-01', 'volle Dosis', '98495920-8665-4209-89d7-d2717dbcfa65', '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (3, 2, 2, '2026-03-01', 'volle Dosis', '98495920-8665-4209-89d7-d2717dbcfa65', '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (4, 3, 2, '2026-03-01', 'volle Dosis', '98495920-8665-4209-89d7-d2717dbcfa65', '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (5, 1, 3, '2026-03-15', '', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (6, 2, 3, '2026-02-01', '', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (7, 2, 4, '2026-04-01', '', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (8, 3, 5, '2026-01-10', '', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (9, 3, 5, '2026-02-10', '', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (10, 4, 6, '2026-05-02', 'Kellerdecke trocken', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (11, 2, 7, '2026-05-03', '', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (12, 1, 8, '2026-05-20', 'Erste Rispe, 8 Knospen', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (13, 1, 2, '2026-04-01', '', NULL, '2026-10-30 08:50:42');
INSERT INTO events (id, object_id, type_id, date, note, batch_id, created_at) VALUES (14, 2, 2, '2026-04-15', '', NULL, '2026-10-30 08:50:42');
INSERT INTO event_attrs (event_id, key, value) VALUES (11, 'Schädlinge', 'keine');
INSERT INTO event_attrs (event_id, key, value) VALUES (13, 'Produkt', 'Orchideendünger');
INSERT INTO event_attrs (event_id, key, value) VALUES (13, 'Menge', '2');
INSERT INTO event_attrs (event_id, key, value) VALUES (14, 'Produkt', 'Orchideendünger');
INSERT INTO event_attrs (event_id, key, value) VALUES (2, 'Produkt', 'Orchideendünger');
INSERT INTO event_attrs (event_id, key, value) VALUES (2, 'Menge', '2.5');
INSERT INTO event_attrs (event_id, key, value) VALUES (3, 'Produkt', 'Orchideendünger');
INSERT INTO event_attrs (event_id, key, value) VALUES (3, 'Menge', '2.5');
INSERT INTO event_attrs (event_id, key, value) VALUES (4, 'Produkt', 'Orchideendünger');
INSERT INTO event_attrs (event_id, key, value) VALUES (4, 'Menge', '2.5');
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (1, 1, 'Standort', 'Ostfenster', NULL, NULL);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (2, 1, 'Substrat', 'Rinde', NULL, NULL);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (3, 1, 'Erworben am', '2025-04-10', NULL, NULL);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (5, 2, 'Standort', 'Südfenster', NULL, NULL);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (6, 3, 'Standort', 'Küche', NULL, NULL);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (7, 1, 'Substrat', 'Bims', '2026-03-15', 5);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (8, 1, 'Topfgröße', '14', '2026-03-15', 5);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (9, 2, 'Substrat', 'Rinde', '2026-02-01', 6);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (10, 2, 'Substrat', 'Sphagnum', NULL, NULL);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (11, 2, 'Standort', 'Fensterbank', '2026-04-01', 7);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (12, 3, 'Wasser', 'Regenwasser', '2026-01-10', 8);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (13, 3, 'Wasser', 'Regenwasser', '2026-02-10', 9);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (14, 3, 'Wasser', 'Leitungswasser', '2026-10-30', NULL);
INSERT INTO object_attrs (id, object_id, key, value, since, event_id) VALUES (15, 2, 'Standort', 'Wohnzimmer', '2026-10-30', NULL);
INSERT INTO event_files (event_id, file_id, position) VALUES (1, '7e79fcb2-7b8e-46dd-bf6a-36716fc43507', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (5, '0e69a8e2-a28f-4189-8d58-42a4dd55bcc0', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (5, 'd70fa074-a56d-436e-8d0f-36e72a78321c', 1);
INSERT INTO event_files (event_id, file_id, position) VALUES (12, 'fe51da47-bfdb-4150-958e-4ab3f5e7975b', 0);
INSERT INTO event_files (event_id, file_id, position) VALUES (12, '089c2807-9fca-4741-996b-5fb13d2cee3e', 1);
INSERT INTO field_kinds (key, kind, unit) VALUES ('Erworben am', 'date', '');
INSERT INTO field_kinds (key, kind, unit) VALUES ('Topfgröße', 'number', 'cm');
INSERT INTO field_kinds (key, kind, unit) VALUES ('Menge', 'number', 'ml');
INSERT INTO settings (key, value) VALUES ('photoTypeId', '1');
INSERT INTO settings (key, value) VALUES ('overviewColumns', '[{"label":"Gedüngt","typeIds":[2]},{"label":"Umgetopft","typeIds":[3]}]');
INSERT INTO settings (key, value) VALUES ('propertyOrder', '["Standort","Substrat"]');
PRAGMA user_version = 7;
