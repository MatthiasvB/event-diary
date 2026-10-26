import type { DiaryObject, ObjectAttr } from '../types.ts';
import { transaction, type Db } from './db.ts';

type Row = {
	id: number;
	name: string;
	active: number;
	notes: string;
	cover_photo_id: string | null;
};

const fromRow = (r: Row): DiaryObject => ({
	id: r.id,
	name: r.name,
	active: !!r.active,
	notes: r.notes,
	coverPhotoId: r.cover_photo_id
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

// The object's first photo (by event date).
// Videos and other files never become the cover.
const FIRST_PHOTO = `(
	SELECT ef.file_id FROM events e JOIN event_files ef ON ef.event_id = e.id
	JOIN files f ON f.id = ef.file_id
	WHERE e.object_id = o.id AND f.mime LIKE 'image/%' ORDER BY e.date, e.id, ef.position LIMIT 1
)`;

// The cover is pinned (see pinCover); the fallback only covers a deleted cover photo.
const SELECT_OBJECT = `
	SELECT o.id, o.name, o.active, o.notes,
		coalesce(o.cover_photo_id, ${FIRST_PHOTO}) AS cover_photo_id
	FROM objects o`;

/** An object without a chosen cover gets its first photo as cover, which then stays. */
export function pinCover(db: Db, objectId: number) {
	db.prepare(
		`UPDATE objects AS o SET cover_photo_id = ${FIRST_PHOTO} WHERE o.id = ? AND o.cover_photo_id IS NULL`
	).run(objectId);
}

// History order: initial values (since NULL) first, then by date, then by insertion.
const HISTORY_ORDER = "coalesce(since, '') , id";

export function listObjects(db: Db): (DiaryObject & { attrs: Record<string, string> })[] {
	const objects = (db.prepare(`${SELECT_OBJECT} ORDER BY o.name`).all() as Row[]).map(fromRow);
	const current = currentAttrs(db);
	return objects.map((o) => ({ ...o, attrs: current.get(o.id) ?? {} }));
}

/** Current attribute values of all objects: object id → key → value. */
export function currentAttrs(db: Db): Map<number, Record<string, string>> {
	const rows = db
		.prepare(`SELECT * FROM object_attrs ORDER BY ${HISTORY_ORDER}`)
		.all() as AttrRow[];
	const result = new Map<number, Record<string, string>>();
	for (const r of rows) {
		const attrs = result.get(r.object_id) ?? {};
		attrs[r.key] = r.value; // later rows win
		result.set(r.object_id, attrs);
	}
	return result;
}

export function getObject(db: Db, id: number): DiaryObject | undefined {
	const row = db.prepare(`${SELECT_OBJECT} WHERE o.id = ?`).get(id) as Row | undefined;
	return row && fromRow(row);
}

/** All attribute values of an object over time, grouped by key, oldest first. */
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

/** Creates an object; returns its ID (internal, never shown). */
export function createObject(db: Db, input: Omit<ObjectInput, 'id'>): number {
	return transaction(db, () => {
		const id = Number(
			db
				.prepare('INSERT INTO objects (name, active, notes) VALUES (?, ?, ?)')
				.run(input.name, input.active ? 1 : 0, input.notes).lastInsertRowid
		);
		const insert = db.prepare('INSERT INTO object_attrs (object_id, key, value) VALUES (?, ?, ?)');
		for (const a of input.attrs) if (a.value) insert.run(id, a.key, a.value);
		return id;
	});
}

/**
 * Saves the object form. Attribute edits here are corrections of the current value;
 * changes over time come from events (e.g. a move sets "Standort" from that date on).
 * A current value that was set by an event is kept, and a new value starts today.
 */
export function updateObject(db: Db, input: ObjectInput, today: string) {
	transaction(db, () => {
		db.prepare('UPDATE objects SET name = ?, active = ?, notes = ? WHERE id = ?').run(
			input.name,
			input.active ? 1 : 0,
			input.notes,
			input.id
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

/**
 * Marks the value before a change as not recorded by removing the initial value
 * ("from the beginning"). With `before`, only if no dated value exists before that date:
 * then the value before was recorded after all.
 */
export function forgetInitialValue(db: Db, objectId: number, key: string, before?: string) {
	db.prepare(
		`DELETE FROM object_attrs WHERE object_id = ? AND key = ? AND since IS NULL AND event_id IS NULL
		AND NOT EXISTS (SELECT 1 FROM object_attrs WHERE object_id = ? AND key = ? AND since < ?)`
	).run(objectId, key, objectId, key, before ?? '');
}

/**
 * Sets the initial value ("from the beginning"), e.g. the known value before a change.
 * With `before`, only if no dated value exists before that date (then that one is the
 * value before).
 */
export function setInitialValue(
	db: Db,
	objectId: number,
	key: string,
	value: string,
	before?: string
) {
	const earlier = db
		.prepare('SELECT 1 FROM object_attrs WHERE object_id = ? AND key = ? AND since < ? LIMIT 1')
		.get(objectId, key, before ?? '');
	if (earlier) return;
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

export function setCover(db: Db, objectId: number, photoId: string | null) {
	db.prepare('UPDATE objects SET cover_photo_id = ? WHERE id = ?').run(photoId, objectId);
}
