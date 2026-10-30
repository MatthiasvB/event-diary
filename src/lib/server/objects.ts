import type { DiaryObject, PropertyValue } from '../types.ts';
import { transaction, type Db } from './db.ts';
import { useField } from './fields.ts';

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

const attrFromRow = ({ id, key, value, since, event_id }: AttrRow): PropertyValue =>
	since === null
		? { id, key, value, since, eventId: null }
		: { id, key, value, since, eventId: event_id };

const FIRST_PHOTO = `(
	SELECT ef.file_id FROM event_objects eo JOIN events e ON e.id = eo.event_id
	JOIN event_files ef ON ef.event_id = e.id JOIN files f ON f.id = ef.file_id
	WHERE eo.object_id = o.id AND f.mime LIKE 'image/%' ORDER BY e.date, e.id, ef.position LIMIT 1
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

const ATTRS = `SELECT a.id, a.object_id, f.name AS key, a.value,
		coalesce(e.date, a.since) AS since, a.event_id
	FROM property_values a JOIN fields f ON f.id = a.field_id
	LEFT JOIN events e ON e.id = a.event_id`;
const HISTORY_ORDER = "coalesce(e.date, a.since, ''), a.id";

export function listObjects(db: Db): (DiaryObject & { attrs: Record<string, string> })[] {
	const objects = (db.prepare(`${SELECT_OBJECT} ORDER BY x.name`).all() as Row[]).map(fromRow);
	const current = currentAttrs(db);
	return objects.map((o) => ({ ...o, attrs: current.get(o.id) ?? {} }));
}

export function currentAttrs(db: Db): Map<number, Record<string, string>> {
	const rows = db.prepare(`${ATTRS} ORDER BY ${HISTORY_ORDER}`).all() as AttrRow[];
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

export function attrHistory(db: Db, objectId: number): Record<string, PropertyValue[]> {
	const rows = db
		.prepare(`${ATTRS} WHERE a.object_id = ? ORDER BY ${HISTORY_ORDER}`)
		.all(objectId) as AttrRow[];
	const result: Record<string, PropertyValue[]> = {};
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
		const insert = db.prepare(
			'INSERT INTO property_values (object_id, field_id, value) VALUES (?, ?, ?)'
		);
		for (const a of input.attrs) {
			if (a.value) insert.run(id, useField(db, a.key, 'property').id, a.value);
		}
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
		for (const a of input.attrs) if (a.value) useField(db, a.key, 'property');
		const history = attrHistory(db, input.id);
		const wanted = new Map(input.attrs.map((a) => [a.key, a.value]));
		for (const key of Object.keys(history)) if (!wanted.has(key)) wanted.set(key, '');

		for (const [key, value] of wanted) {
			const current = history[key]?.at(-1);
			if (current?.value === value) continue;
			if (current && !current.eventId) {
				if (value)
					db.prepare('UPDATE property_values SET value = ? WHERE id = ?').run(value, current.id);
				else db.prepare('DELETE FROM property_values WHERE id = ?').run(current.id);
			} else if (value) {
				db.prepare(
					'INSERT INTO property_values (object_id, field_id, value, since) VALUES (?, ?, ?, ?)'
				).run(input.id, useField(db, key, 'property').id, value, current ? today : null);
			}
		}
	});
}

const INITIAL = `object_id = ? AND field_id = (SELECT id FROM fields WHERE name = ?)
	AND since IS NULL AND event_id IS NULL`;

export function forgetInitialValue(db: Db, objectId: number, key: string) {
	db.prepare(`DELETE FROM property_values WHERE ${INITIAL}`).run(objectId, key);
}

export function setInitialValue(db: Db, objectId: number, key: string, value: string) {
	const updated = db
		.prepare(`UPDATE property_values SET value = ? WHERE ${INITIAL}`)
		.run(value, objectId, key);
	if (!updated.changes) {
		db.prepare('INSERT INTO property_values (object_id, field_id, value) VALUES (?, ?, ?)').run(
			objectId,
			useField(db, key, 'property').id,
			value
		);
	}
}

export function allHistories(db: Db): Record<number, Record<string, PropertyValue[]>> {
	const rows = db.prepare(`${ATTRS} ORDER BY ${HISTORY_ORDER}`).all() as AttrRow[];
	const result: Record<number, Record<string, PropertyValue[]>> = {};
	for (const r of rows) ((result[r.object_id] ??= {})[r.key] ??= []).push(attrFromRow(r));
	return result;
}

export function setCover(db: Db, objectId: number, photoId: string | null) {
	db.prepare('UPDATE objects SET cover_photo_id = ? WHERE id = ?').run(photoId, objectId);
}
