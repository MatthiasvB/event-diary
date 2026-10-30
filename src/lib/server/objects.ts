import type { DiaryObject, FieldTemplate, ObjectAttr } from '../types.ts';
import { transaction, type Db } from './db.ts';

type Row = {
	id: number;
	name: string;
	active: number;
	notes: string;
	cover_photo_id: string | null;
	cover_width: number | null;
	cover_height: number | null;
};

const fromRow = (r: Row): DiaryObject => ({
	id: r.id,
	name: r.name,
	active: !!r.active,
	notes: r.notes,
	coverPhotoId: r.cover_photo_id,
	coverRatio: r.cover_width && r.cover_height ? r.cover_width / r.cover_height : null
});

type AttrRow = {
	id: number;
	object_id: number;
	key: string;
	value: string;
	since: string | null;
	event_id: number | null;
};

const attrFromRow = (r: AttrRow): ObjectAttr => ({
	id: r.id,
	key: r.key,
	value: r.value,
	since: r.since,
	eventId: r.event_id
});

const FIRST_PHOTO = `(
	SELECT ef.file_id FROM events e JOIN event_files ef ON ef.event_id = e.id
	JOIN files f ON f.id = ef.file_id
	WHERE e.object_id = o.id AND f.mime LIKE 'image/%' ORDER BY e.date, e.id, ef.position LIMIT 1
)`;

// pinCover fixes the cover. The fallback only applies once the pinned photo is deleted.
const SELECT_OBJECT = `
	SELECT x.*, f.width AS cover_width, f.height AS cover_height FROM (
		SELECT o.id, o.name, o.active, o.notes,
			coalesce(o.cover_photo_id, ${FIRST_PHOTO}) AS cover_photo_id
		FROM objects o
	) x LEFT JOIN files f ON f.id = x.cover_photo_id`;

export function pinCover(db: Db, objectId: number) {
	db.prepare(
		`UPDATE objects AS o SET cover_photo_id = ${FIRST_PHOTO} WHERE o.id = ? AND o.cover_photo_id IS NULL`
	).run(objectId);
}

const HISTORY_ORDER = "coalesce(since, '') , id";

export function listObjects(db: Db): (DiaryObject & { attrs: Record<string, string> })[] {
	const objects = (db.prepare(`${SELECT_OBJECT} ORDER BY x.name`).all() as Row[]).map(fromRow);
	const current = currentAttrs(db);
	return objects.map((o) => ({ ...o, attrs: current.get(o.id) ?? {} }));
}

export function currentAttrs(db: Db): Map<number, Record<string, string>> {
	const rows = db
		.prepare(`SELECT * FROM object_attrs ORDER BY ${HISTORY_ORDER}`)
		.all() as AttrRow[];
	const result = new Map<number, Record<string, string>>();
	for (const r of rows) {
		const attrs = result.get(r.object_id) ?? {};
		attrs[r.key] = r.value;
		result.set(r.object_id, attrs);
	}
	return result;
}

export function getObject(db: Db, id: number): DiaryObject | undefined {
	const row = db.prepare(`${SELECT_OBJECT} WHERE x.id = ?`).get(id) as Row | undefined;
	return row && fromRow(row);
}

export function attrHistory(db: Db, objectId: number): Record<string, ObjectAttr[]> {
	const rows = db
		.prepare(`SELECT * FROM object_attrs WHERE object_id = ? ORDER BY ${HISTORY_ORDER}`)
		.all(objectId) as AttrRow[];
	const result: Record<string, ObjectAttr[]> = {};
	for (const r of rows) (result[r.key] ??= []).push(attrFromRow(r));
	return result;
}

export type ObjectInput = {
	id: number;
	name: string;
	active: boolean;
	notes: string;
	attrs: { key: string; value: string }[];
};

export function createObject(db: Db, input: Omit<ObjectInput, 'id'>): number {
	return transaction(db, () => {
		const id = Number(
			db
				.prepare('INSERT INTO objects (name, active, notes) VALUES (?, ?, ?)')
				.run(input.name, input.active ? 1 : 0, input.notes).lastInsertRowid
		);
		const insert = db.prepare('INSERT INTO object_attrs (object_id, key, value) VALUES (?, ?, ?)');
		for (const a of input.attrs) if (a.value) insert.run(id, a.key, a.value);
		promoteToProperties(db);
		return id;
	});
}

/**
 * Attribute edits here correct the current value. Changes over time come from events. A
 * current value set by an event is kept, and a new value starts today.
 */
export function updateObject(db: Db, input: ObjectInput, today: string) {
	transaction(db, () => {
		db.prepare('UPDATE objects SET name = ?, active = ?, notes = ? WHERE id = ?').run(
			input.name,
			input.active ? 1 : 0,
			input.notes,
			input.id
		);
		// A name that was an event detail brings its values from past events along first, so
		// the value entered here applies from today on (unless it is the same).
		promoteToProperties(
			db,
			input.attrs.filter((a) => a.value).map((a) => a.key)
		);
		const history = attrHistory(db, input.id);
		const wanted = new Map(input.attrs.map((a) => [a.key, a.value]));
		for (const key of Object.keys(history)) if (!wanted.has(key)) wanted.set(key, '');

		for (const [key, value] of wanted) {
			const current = history[key]?.at(-1);
			if (current?.value === value) continue;
			if (current && !current.eventId) {
				if (value)
					db.prepare('UPDATE object_attrs SET value = ? WHERE id = ?').run(value, current.id);
				else db.prepare('DELETE FROM object_attrs WHERE id = ?').run(current.id);
			} else if (value) {
				db.prepare(
					'INSERT INTO object_attrs (object_id, key, value, since) VALUES (?, ?, ?, ?)'
				).run(input.id, key, value, current ? today : null);
			}
		}
	});
}

export type Change = { date: string; eventId: number };

// A dated value of the key, other than the change's own, on or before its date. If there is
// one, the change is not the first one.
const EARLIER_CHANGE = `SELECT 1 FROM object_attrs WHERE object_id = ? AND key = ?
	AND since IS NOT NULL AND since <= ? AND event_id IS NOT ?`;

/**
 * Marks the value before the first change as not recorded. With `change`, only if that
 * change is the key's first.
 */
export function forgetInitialValue(db: Db, objectId: number, key: string, change?: Change) {
	if (change && db.prepare(EARLIER_CHANGE).get(objectId, key, change.date, change.eventId)) return;
	db.prepare(
		'DELETE FROM object_attrs WHERE object_id = ? AND key = ? AND since IS NULL AND event_id IS NULL'
	).run(objectId, key);
}

/** With `change`, only if that change is the key's first. */
export function setInitialValue(
	db: Db,
	objectId: number,
	key: string,
	value: string,
	change?: Change
) {
	if (change && db.prepare(EARLIER_CHANGE).get(objectId, key, change.date, change.eventId)) return;
	const updated = db
		.prepare(
			'UPDATE object_attrs SET value = ? WHERE object_id = ? AND key = ? AND since IS NULL AND event_id IS NULL'
		)
		.run(value, objectId, key);
	if (!updated.changes) {
		db.prepare('INSERT INTO object_attrs (object_id, key, value) VALUES (?, ?, ?)').run(
			objectId,
			key,
			value
		);
	}
}

export function allHistories(db: Db): Record<number, Record<string, ObjectAttr[]>> {
	const rows = db
		.prepare(`SELECT * FROM object_attrs ORDER BY ${HISTORY_ORDER}`)
		.all() as AttrRow[];
	const result: Record<number, Record<string, ObjectAttr[]>> = {};
	for (const r of rows) ((result[r.object_id] ??= {})[r.key] ??= []).push(attrFromRow(r));
	return result;
}

export function propertyKeys(db: Db): Set<string> {
	const rows = db.prepare('SELECT DISTINCT key FROM object_attrs').all() as { key: string }[];
	return new Set(rows.map((r) => r.key));
}

/**
 * Turns event details whose name is a property, or one of `newNames`, into changes of that
 * property on the event's date. Call after anything that adds property names.
 */
export function promoteToProperties(db: Db, newNames: string[] = []) {
	const names = `(SELECT key FROM object_attrs UNION SELECT value FROM json_each(?))`;
	const json = JSON.stringify(newNames);
	db.prepare(
		`INSERT INTO object_attrs (object_id, key, value, since, event_id)
		SELECT e.object_id, a.key, a.value, e.date, a.event_id
		FROM event_attrs a JOIN events e ON e.id = a.event_id
		WHERE a.key IN ${names}
		ORDER BY e.date, e.id`
	).run(json);
	db.prepare(`DELETE FROM event_attrs WHERE key IN ${names}`).run(json);
	const properties = propertyKeys(db);
	const types = db.prepare('SELECT id, fields FROM event_types').all() as {
		id: number;
		fields: string;
	}[];
	for (const ty of types) {
		const fields = (JSON.parse(ty.fields) as FieldTemplate[]).map((f) =>
			properties.has(f.key) ? { ...f, target: 'object' as const } : f
		);
		const unique = fields.filter((f, i) => fields.findIndex((g) => g.key === f.key) === i);
		const json = JSON.stringify(unique);
		if (json !== ty.fields) {
			db.prepare('UPDATE event_types SET fields = ? WHERE id = ?').run(json, ty.id);
		}
	}
}

export function setCover(db: Db, objectId: number, photoId: string | null) {
	db.prepare('UPDATE objects SET cover_photo_id = ? WHERE id = ?').run(photoId, objectId);
}
