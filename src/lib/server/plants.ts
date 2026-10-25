import type { Plant, PlantAttr } from '../types.ts';
import { transaction, type Db } from './db.ts';

type Row = {
	id: string;
	name: string;
	active: number;
	acquired_on: string | null;
	notes: string;
	cover_photo_id: string | null;
};

const fromRow = (r: Row): Plant => ({
	id: r.id,
	name: r.name,
	active: !!r.active,
	acquiredOn: r.acquired_on,
	notes: r.notes,
	coverPhotoId: r.cover_photo_id
});

type AttrRow = {
	id: number;
	plant_id: string;
	key: string;
	value: string;
	since: string | null;
	event_id: number | null;
};

const attrFromRow = (r: AttrRow): PlantAttr => ({
	id: r.id,
	key: r.key,
	value: r.value,
	since: r.since,
	eventId: r.event_id
});

// The plant's first photo (by event date).
const FIRST_PHOTO = `(
	SELECT ep.photo_id FROM events e JOIN event_photos ep ON ep.event_id = e.id
	WHERE e.plant_id = p.id ORDER BY e.date, e.id, ep.position LIMIT 1
)`;

// The cover is pinned (see pinCover); the fallback only covers a deleted cover photo.
const SELECT_PLANT = `
	SELECT p.id, p.name, p.active, p.acquired_on, p.notes,
		coalesce(p.cover_photo_id, ${FIRST_PHOTO}) AS cover_photo_id
	FROM plants p`;

/** A plant without a chosen cover gets its first photo as cover, which then stays. */
export function pinCover(db: Db, plantId: string) {
	db.prepare(
		`UPDATE plants AS p SET cover_photo_id = ${FIRST_PHOTO} WHERE p.id = ? AND p.cover_photo_id IS NULL`
	).run(plantId);
}

// History order: initial values (since NULL) first, then by date, then by insertion.
const HISTORY_ORDER = "coalesce(since, '') , id";

export function listPlants(db: Db): (Plant & { attrs: Record<string, string> })[] {
	const plants = (db.prepare(`${SELECT_PLANT} ORDER BY p.name`).all() as Row[]).map(fromRow);
	const current = currentAttrs(db);
	return plants.map((p) => ({ ...p, attrs: current.get(p.id) ?? {} }));
}

/** Current attribute values of all plants: plant id → key → value. */
export function currentAttrs(db: Db): Map<string, Record<string, string>> {
	const rows = db.prepare(`SELECT * FROM plant_attrs ORDER BY ${HISTORY_ORDER}`).all() as AttrRow[];
	const result = new Map<string, Record<string, string>>();
	for (const r of rows) {
		const attrs = result.get(r.plant_id) ?? {};
		attrs[r.key] = r.value; // later rows win
		result.set(r.plant_id, attrs);
	}
	return result;
}

export function getPlant(db: Db, id: string): Plant | undefined {
	const row = db.prepare(`${SELECT_PLANT} WHERE p.id = ?`).get(id) as Row | undefined;
	return row && fromRow(row);
}

/** All attribute values of a plant over time, grouped by key, oldest first. */
export function attrHistory(db: Db, plantId: string): Record<string, PlantAttr[]> {
	const rows = db
		.prepare(`SELECT * FROM plant_attrs WHERE plant_id = ? ORDER BY ${HISTORY_ORDER}`)
		.all(plantId) as AttrRow[];
	const result: Record<string, PlantAttr[]> = {};
	for (const r of rows) (result[r.key] ??= []).push(attrFromRow(r));
	return result;
}

/**
 * Next free internal ID, e.g. P-022 → P-023. IDs in use are never reused. Only used in
 * URLs and the database, never shown.
 */
export function nextPlantId(db: Db): string {
	const prefix = 'P-';
	const ids = db
		.prepare('SELECT id FROM plants WHERE substr(id, 1, ?) = ?')
		.all(prefix.length, prefix) as {
		id: string;
	}[];
	let max = 0;
	let width = 3;
	for (const { id } of ids) {
		const digits = id.slice(prefix.length);
		if (!/^\d+$/.test(digits)) continue;
		max = Math.max(max, Number(digits));
		width = Math.max(width, digits.length);
	}
	return prefix + String(max + 1).padStart(width, '0');
}

export type PlantInput = {
	id: string;
	name: string;
	active: boolean;
	acquiredOn: string | null;
	notes: string;
	attrs: { key: string; value: string }[];
};

export function createPlant(db: Db, input: PlantInput) {
	transaction(db, () => {
		db.prepare(
			'INSERT INTO plants (id, name, active, acquired_on, notes) VALUES (?, ?, ?, ?, ?)'
		).run(input.id, input.name, input.active ? 1 : 0, input.acquiredOn, input.notes);
		const insert = db.prepare('INSERT INTO plant_attrs (plant_id, key, value) VALUES (?, ?, ?)');
		for (const a of input.attrs) if (a.value) insert.run(input.id, a.key, a.value);
	});
}

/**
 * Saves the plant form. Attribute edits here are corrections of the current value;
 * changes over time come from events (e.g. a move sets "Standort" from that date on).
 * A current value that was set by an event is kept, and a new value starts today.
 */
export function updatePlant(db: Db, input: PlantInput, today: string) {
	transaction(db, () => {
		db.prepare(
			'UPDATE plants SET name = ?, active = ?, acquired_on = ?, notes = ? WHERE id = ?'
		).run(input.name, input.active ? 1 : 0, input.acquiredOn, input.notes, input.id);
		const history = attrHistory(db, input.id);
		const wanted = new Map(input.attrs.map((a) => [a.key, a.value]));
		for (const key of Object.keys(history)) if (!wanted.has(key)) wanted.set(key, '');

		for (const [key, value] of wanted) {
			const current = history[key]?.at(-1);
			if (current?.value === value) continue;
			if (current && !current.eventId) {
				if (value)
					db.prepare('UPDATE plant_attrs SET value = ? WHERE id = ?').run(value, current.id);
				else db.prepare('DELETE FROM plant_attrs WHERE id = ?').run(current.id);
			} else if (value) {
				db.prepare('INSERT INTO plant_attrs (plant_id, key, value, since) VALUES (?, ?, ?, ?)').run(
					input.id,
					key,
					value,
					current ? today : null
				);
			}
		}
	});
}

/**
 * Marks the value before a change as not recorded by removing the initial value
 * ("from the beginning"). With `before`, only if no dated value exists before that date:
 * then the value before was recorded after all.
 */
export function forgetInitialValue(db: Db, plantId: string, key: string, before?: string) {
	db.prepare(
		`DELETE FROM plant_attrs WHERE plant_id = ? AND key = ? AND since IS NULL AND event_id IS NULL
		AND NOT EXISTS (SELECT 1 FROM plant_attrs WHERE plant_id = ? AND key = ? AND since < ?)`
	).run(plantId, key, plantId, key, before ?? '');
}

/**
 * Sets the initial value ("from the beginning"), e.g. the known value before a change.
 * With `before`, only if no dated value exists before that date (then that one is the
 * value before).
 */
export function setInitialValue(
	db: Db,
	plantId: string,
	key: string,
	value: string,
	before?: string
) {
	const earlier = db
		.prepare('SELECT 1 FROM plant_attrs WHERE plant_id = ? AND key = ? AND since < ? LIMIT 1')
		.get(plantId, key, before ?? '');
	if (earlier) return;
	const updated = db
		.prepare(
			'UPDATE plant_attrs SET value = ? WHERE plant_id = ? AND key = ? AND since IS NULL AND event_id IS NULL'
		)
		.run(value, plantId, key);
	if (!updated.changes) {
		db.prepare('INSERT INTO plant_attrs (plant_id, key, value) VALUES (?, ?, ?)').run(
			plantId,
			key,
			value
		);
	}
}

export function setCover(db: Db, plantId: string, photoId: string | null) {
	db.prepare('UPDATE plants SET cover_photo_id = ? WHERE id = ?').run(photoId, plantId);
}
