import { formatTarget, parseTarget } from '../domain/associations.ts';
import type { FieldKinds } from '../fieldKinds.ts';
import type { DiaryObject, PropertyValue } from '../types.ts';
import { t } from '../i18n.ts';
import { transaction, type Db } from './db.ts';
import { useField } from './fields.ts';
import { Refused } from './refusals.ts';

type Row = {
	id: number;
	name: string;
	active: number;
	listed: number;
	stock_along: string | null;
	notes: string;
	cover_photo_id: string | null;
	cover_width: number | null;
	cover_height: number | null;
};

const fromRow = (r: Row): DiaryObject => ({
	id: r.id,
	name: r.name,
	active: !!r.active,
	listed: !!r.listed,
	stock: r.stock_along === null ? null : { along: r.stock_along },
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
		SELECT o.id, o.name, o.active, o.listed, o.notes,
			(SELECT name FROM fields WHERE id = o.stock_field_id) AS stock_along,
			coalesce(o.cover_photo_id, ${FIRST_PHOTO}) AS cover_photo_id
		FROM objects o
	) x LEFT JOIN files f ON f.id = x.cover_photo_id`;

export function pinCover(db: Db, objectId: number) {
	db.prepare(
		`UPDATE objects AS o SET cover_photo_id = ${FIRST_PHOTO} WHERE o.id = ? AND o.cover_photo_id IS NULL`
	).run(objectId);
}

const ATTRS = `SELECT a.id, a.object_id, f.name AS key,
		coalesce(a.value, CAST(a.target_id AS TEXT)) AS value,
		coalesce(e.date, a.since) AS since, a.event_id
	FROM property_values a JOIN fields f ON f.id = a.field_id
	LEFT JOIN events e ON e.id = a.event_id`;
const HISTORY_ORDER = "coalesce(e.date, a.since, ''), a.id";

// The value as entered: an association's is the id of the object it points to.
const SPLIT_VALUE = `iif(f.kind = 'object', NULL, :value),
	iif(f.kind = 'object', CAST(:value AS INTEGER), NULL)`;

export function insertValue(
	db: Db,
	row: { objectId: number; fieldId: number; value: string; since?: string; eventId?: number }
) {
	db.prepare(
		`INSERT INTO property_values (object_id, field_id, value, target_id, since, event_id)
		SELECT :object, f.id, ${SPLIT_VALUE}, :since, :event FROM fields f WHERE f.id = :field`
	).run({
		object: row.objectId,
		field: row.fieldId,
		value: row.value,
		since: row.since ?? null,
		event: row.eventId ?? null
	});
}

function updateValue(db: Db, id: number, value: string) {
	db.prepare(
		`UPDATE property_values AS a SET (value, target_id) = (${SPLIT_VALUE})
		FROM fields f WHERE f.id = a.field_id AND a.id = :id`
	).run({ id, value });
}

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

/** The objects that can be associated, and hold units of a stock. */
export function itemNames(db: Db): Record<number, string> {
	const rows = db.prepare('SELECT id, name FROM objects WHERE NOT stock').all() as {
		id: number;
		name: string;
	}[];
	return Object.fromEntries(rows.map((r) => [r.id, r.name]));
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
	listed: boolean;
	stock: { along: string } | null;
	notes: string;
	attrs: { key: string; value: string }[];
};

/** The association a stock's units are spread along. A new name becomes one. */
function stockField(db: Db, stock: { along: string } | null): number | null {
	if (!stock) return null;
	const field = db
		.prepare(
			`INSERT INTO fields (name, role, kind) VALUES (?, 'property', 'object')
			ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id, kind`
		)
		.get(stock.along) as { id: number; kind: string };
	if (field.kind !== 'object') throw new Refused(t.units.notAnAssociation(stock.along));
	return field.id;
}

export function createObject(db: Db, input: Omit<ObjectInput, 'id'>): number {
	return transaction(db, () => {
		const id = Number(
			db
				.prepare(
					`INSERT INTO objects (name, active, listed, stock_field_id, notes)
					VALUES (?, ?, ?, ?, ?)`
				)
				.run(
					input.name,
					input.active ? 1 : 0,
					input.listed ? 1 : 0,
					stockField(db, input.stock),
					input.notes
				).lastInsertRowid
		);
		for (const a of input.attrs) {
			if (a.value)
				insertValue(db, {
					objectId: id,
					fieldId: useField(db, a.key, 'property').id,
					value: a.value
				});
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
		db.prepare(
			`UPDATE objects SET name = ?, active = ?, listed = ?, stock_field_id = ?, notes = ?
			WHERE id = ?`
		).run(
			input.name,
			input.active ? 1 : 0,
			input.listed ? 1 : 0,
			stockField(db, input.stock),
			input.notes,
			input.id
		);
		const wanted = new Map(input.attrs.map((a) => [a.key, a.value]));
		for (const key of Object.keys(attrHistory(db, input.id)))
			if (!wanted.has(key)) wanted.set(key, '');
		for (const [key, value] of wanted) setProperty(db, input.id, key, value, today);
	});
}

/** As `updateObject` does for each of its attributes. An empty value removes the current one. */
export function setProperty(db: Db, objectId: number, key: string, value: string, today: string) {
	transaction(db, () => {
		// A name that was an event detail brings its values from past events along first, so
		// the value entered here applies from today on (unless it is the same).
		if (value) useField(db, key, 'property');
		const current = attrHistory(db, objectId)[key]?.at(-1);
		if (current?.value === value) return;
		if (current && !current.eventId) {
			if (value) updateValue(db, current.id, value);
			else db.prepare('DELETE FROM property_values WHERE id = ?').run(current.id);
		} else if (value) {
			const fieldId = useField(db, key, 'property').id;
			insertValue(db, { objectId, fieldId, value, ...(current && { since: today }) });
		}
	});
}

/**
 * An association's value names an object to create, or one that may be gone by now. Values
 * that point nowhere are left out.
 */
export function resolveTargets<T extends { key: string; value: string }>(
	db: Db,
	kinds: FieldKinds,
	entries: T[]
): T[] {
	return entries.flatMap((e) => {
		if (kinds[e.key]?.kind !== 'object' || !e.value) return [e];
		const id = resolveTarget(db, e.value);
		return id === null ? [] : [{ ...e, value: formatTarget({ id }) }];
	});
}

/** The item the value names, created if it is new. */
export function resolveTarget(db: Db, value: string): number | null {
	const target = parseTarget(value);
	if (!target) return null;
	if ('name' in target) {
		const { id } = db
			.prepare('INSERT INTO objects (name, listed) VALUES (?, 0) RETURNING id')
			.get(target.name) as { id: number };
		return id;
	}
	return db.prepare('SELECT 1 FROM objects WHERE id = ? AND NOT stock').get(target.id)
		? target.id
		: null;
}

/** The names of the objects whose values or units, now or before, point to this one. */
export function referrers(db: Db, id: number): string[] {
	const rows = db
		.prepare(
			`SELECT DISTINCT o.name FROM objects o WHERE o.id IN (
				SELECT object_id FROM property_values WHERE target_id = ?1
				UNION SELECT object_id FROM unit_moves WHERE ?1 IN (from_id, to_id)
			) ORDER BY o.name`
		)
		.all(id) as { name: string }[];
	return rows.map((r) => r.name);
}

const INITIAL = `object_id = ? AND field_id = (SELECT id FROM fields WHERE name = ?)
	AND since IS NULL AND event_id IS NULL`;

export function forgetInitialValue(db: Db, objectId: number, key: string) {
	db.prepare(`DELETE FROM property_values WHERE ${INITIAL}`).run(objectId, key);
}

export function setInitialValue(db: Db, objectId: number, key: string, value: string) {
	const initial = db
		.prepare(`SELECT id FROM property_values WHERE ${INITIAL}`)
		.get(objectId, key) as { id: number } | undefined;
	if (initial) updateValue(db, initial.id, value);
	else insertValue(db, { objectId, fieldId: useField(db, key, 'property').id, value });
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
