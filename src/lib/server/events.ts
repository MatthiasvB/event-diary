import { randomUUID } from 'node:crypto';
import type { DiaryEvent, Field, FieldTemplate } from '../types.ts';
import { transaction, type Db } from './db.ts';
import { getType } from './eventTypes.ts';
import { deletePhotos } from './photos.ts';
import { forgetInitialValue, pinCover, setInitialValue } from './plants.ts';

type Row = {
	id: number;
	plant_id: string;
	plant_name: string;
	type_id: number;
	type_name: string;
	category: string;
	milestone: number;
	date: string;
	note: string;
	batch_id: string | null;
	batch_size: number;
};

const SELECT = `
	SELECT e.id, e.plant_id, p.name AS plant_name, e.type_id, t.name AS type_name, t.category,
		t.milestone, e.date, e.note, e.batch_id,
		CASE WHEN e.batch_id IS NULL THEN 1
			ELSE (SELECT count(*) FROM events b WHERE b.batch_id = e.batch_id) END AS batch_size
	FROM events e
	JOIN plants p ON p.id = e.plant_id
	JOIN event_types t ON t.id = e.type_id`;

export type EventFilter = {
	plantId?: string;
	typeId?: number;
	category?: string;
	from?: string;
	to?: string;
	limit?: number;
};

export function listEvents(db: Db, f: EventFilter = {}): DiaryEvent[] {
	const where: string[] = [];
	const params: (string | number)[] = [];
	const add = (sql: string, value: string | number | undefined) => {
		if (value === undefined || value === '') return;
		where.push(sql);
		params.push(value);
	};
	add('e.plant_id = ?', f.plantId);
	add('e.type_id = ?', f.typeId);
	add('t.category = ?', f.category);
	add('e.date >= ?', f.from);
	add('e.date <= ?', f.to);
	const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		ORDER BY e.date DESC, e.id DESC LIMIT ?`;
	const rows = db.prepare(sql).all(...params, f.limit ?? 500) as Row[];
	return withDetails(db, rows);
}

export function getEvent(db: Db, id: number): DiaryEvent | undefined {
	const row = db.prepare(`${SELECT} WHERE e.id = ?`).get(id) as Row | undefined;
	return row && withDetails(db, [row])[0];
}

/** Fields of the most recent event of each type, used to prefill the next entry. */
export function lastFieldsByType(db: Db): Record<number, Field[]> {
	const rows = db
		.prepare(
			`${SELECT} WHERE e.id = (SELECT l.id FROM events l WHERE l.type_id = e.type_id
				ORDER BY l.date DESC, l.id DESC LIMIT 1)`
		)
		.all() as Row[];
	return Object.fromEntries(withDetails(db, rows).map((e) => [e.typeId, e.fields]));
}

function withDetails(db: Db, rows: Row[]): DiaryEvent[] {
	if (!rows.length) return [];
	const ids = rows.map((r) => r.id);
	const placeholders = ids.map(() => '?').join(',');
	const fields = new Map<number, Field[]>();
	const photos = new Map<number, string[]>();

	const eventAttrs = db
		.prepare(
			`SELECT event_id, key, value FROM event_attrs WHERE event_id IN (${placeholders}) ORDER BY rowid`
		)
		.all(...ids) as { event_id: number; key: string; value: string }[];
	for (const a of eventAttrs)
		push(fields, a.event_id, { key: a.key, value: a.value, target: 'event' as const });

	const plantAttrs = db
		.prepare(
			`SELECT event_id, key, value FROM plant_attrs WHERE event_id IN (${placeholders}) ORDER BY id`
		)
		.all(...ids) as { event_id: number; key: string; value: string }[];
	for (const a of plantAttrs)
		push(fields, a.event_id, { key: a.key, value: a.value, target: 'plant' as const });

	const links = db
		.prepare(
			`SELECT event_id, photo_id FROM event_photos WHERE event_id IN (${placeholders}) ORDER BY position`
		)
		.all(...ids) as { event_id: number; photo_id: string }[];
	for (const l of links) push(photos, l.event_id, l.photo_id);

	return rows.map((r) => ({
		id: r.id,
		plantId: r.plant_id,
		plantName: r.plant_name,
		typeId: r.type_id,
		typeName: r.type_name,
		category: r.category,
		milestone: !!r.milestone,
		date: r.date,
		note: r.note,
		batchId: r.batch_id,
		batchSize: r.batch_size,
		fields: fields.get(r.id) ?? [],
		photos: photos.get(r.id) ?? []
	}));
}

function push<T>(map: Map<number, T[]>, key: number, value: T) {
	const list = map.get(key);
	if (list) list.push(value);
	else map.set(key, [value]);
}

export type EventInput = {
	typeId: number;
	date: string;
	note: string;
	fields: Field[];
	photoIds: string[];
};

function writeDetails(db: Db, eventId: number, plantId: string, input: EventInput) {
	db.prepare('DELETE FROM event_attrs WHERE event_id = ?').run(eventId);
	db.prepare('DELETE FROM plant_attrs WHERE event_id = ?').run(eventId);
	db.prepare('DELETE FROM event_photos WHERE event_id = ?').run(eventId);
	const eventAttr = db.prepare(
		'INSERT OR REPLACE INTO event_attrs (event_id, key, value) VALUES (?, ?, ?)'
	);
	const plantAttr = db.prepare(
		'INSERT INTO plant_attrs (plant_id, key, value, since, event_id) VALUES (?, ?, ?, ?, ?)'
	);
	for (const f of input.fields) {
		if (!f.key || !f.value) continue;
		if (f.target === 'plant') {
			plantAttr.run(plantId, f.key, f.value, input.date, eventId);
			if (f.previous === null) forgetInitialValue(db, plantId, f.key, input.date);
			else if (f.previous) setInitialValue(db, plantId, f.key, f.previous, input.date);
		} else {
			eventAttr.run(eventId, f.key, f.value);
		}
	}
	const photo = db.prepare(
		'INSERT OR IGNORE INTO event_photos (event_id, photo_id, position) VALUES (?, ?, ?)'
	);
	input.photoIds.forEach((id, i) => photo.run(eventId, id, i));
	if (input.photoIds.length) pinCover(db, plantId);
}

/** The type learns which fields it is used with, so the next entry offers them. */
function learnFields(db: Db, typeId: number, fields: Field[]) {
	const type = getType(db, typeId);
	if (!type) return;
	const known = new Set(type.fields.map((f) => `${f.target}:${f.key}`));
	const learned: FieldTemplate[] = fields
		.filter((f) => f.key && !known.has(`${f.target}:${f.key}`))
		.map((f) => ({ key: f.key, target: f.target }));
	if (!learned.length) return;
	db.prepare('UPDATE event_types SET fields = ? WHERE id = ?').run(
		JSON.stringify([...type.fields, ...learned]),
		typeId
	);
}

/** One event per plant; several plants form a batch that can be corrected together. */
export function createEvents(db: Db, plantIds: string[], input: EventInput): number[] {
	return transaction(db, () => {
		const batchId = plantIds.length > 1 ? randomUUID() : null;
		const insert = db.prepare(
			'INSERT INTO events (plant_id, type_id, date, note, batch_id) VALUES (?, ?, ?, ?, ?)'
		);
		const ids = plantIds.map((plantId) => {
			const id = Number(
				insert.run(plantId, input.typeId, input.date, input.note, batchId).lastInsertRowid
			);
			writeDetails(db, id, plantId, input);
			return id;
		});
		learnFields(db, input.typeId, input.fields);
		return ids;
	});
}

/**
 * Updates an event, or all events of its batch. The plant can only be changed for a
 * single event. Returns photos that are no longer referenced.
 */
export function updateEvent(
	db: Db,
	id: number,
	input: EventInput & { plantId: string },
	applyToBatch: boolean
): string[] {
	return transaction(db, () => {
		const event = getEvent(db, id);
		if (!event) throw new Error(`Event ${id} not found`);
		const targets =
			applyToBatch && event.batchId
				? (db.prepare('SELECT id, plant_id FROM events WHERE batch_id = ?').all(event.batchId) as {
						id: number;
						plant_id: string;
					}[])
				: [{ id, plant_id: input.plantId }];
		const before = photosOf(
			db,
			targets.map((t) => t.id)
		);
		const update = db.prepare('UPDATE events SET type_id = ?, date = ?, note = ? WHERE id = ?');
		for (const t of targets) {
			update.run(input.typeId, input.date, input.note, t.id);
			writeDetails(db, t.id, t.plant_id, input);
		}
		if (targets.length === 1) {
			db.prepare('UPDATE events SET plant_id = ? WHERE id = ?').run(input.plantId, id);
		}
		learnFields(db, input.typeId, input.fields);
		return orphaned(db, before);
	});
}

// Events to delete, as a condition on `events`. The SQL is fixed here; only the
// parameter comes from outside.
type Selection = { where: string; param: string | number };
const ofEvent = (id: number): Selection => ({ where: 'id = ?', param: id });
const ofPlant = (id: string): Selection => ({ where: 'plant_id = ?', param: id });
const ofType = (id: number): Selection => ({ where: 'type_id = ?', param: id });
const ofCategory = (category: string): Selection => ({
	where: 'type_id IN (SELECT id FROM event_types WHERE category = ?)',
	param: category
});

/** What a deletion takes along: the events, and the photos no other event uses. */
export type Impact = { events: number; photos: number };

function impact(db: Db, { where, param }: Selection): Impact {
	return db
		.prepare(
			`WITH doomed AS (SELECT id FROM events WHERE ${where})
			SELECT (SELECT count(*) FROM doomed) AS events,
				(SELECT count(DISTINCT photo_id) FROM event_photos
				WHERE event_id IN doomed AND photo_id NOT IN (
					SELECT photo_id FROM event_photos WHERE event_id NOT IN doomed)) AS photos`
		)
		.get(param) as Impact;
}

/**
 * Deletes the selected events and runs `then` in the same transaction. Photos go along
 * unless another event still uses them; plant attributes the events set fall back to
 * their previous value.
 */
function deleteEvents(db: Db, { where, param }: Selection, then = () => {}) {
	const orphans = transaction(db, () => {
		const before = (
			db
				.prepare(
					`SELECT DISTINCT photo_id FROM event_photos
					WHERE event_id IN (SELECT id FROM events WHERE ${where})`
				)
				.all(param) as { photo_id: string }[]
		).map((r) => r.photo_id);
		db.prepare(`DELETE FROM events WHERE ${where}`).run(param);
		then();
		return orphaned(db, before);
	});
	deletePhotos(db, orphans);
}

export function deleteEvent(db: Db, id: number) {
	deleteEvents(db, ofEvent(id));
}

export const plantImpact = (db: Db, id: string) => impact(db, ofPlant(id));

/** Deletes a plant with all its events. Events of other plants stay as they are. */
export function deletePlant(db: Db, id: string) {
	deleteEvents(db, ofPlant(id), () => db.prepare('DELETE FROM plants WHERE id = ?').run(id));
}

export const typeImpact = (db: Db, id: number) => impact(db, ofType(id));

/** Deletes an event type with all its events. */
export function deleteType(db: Db, id: number) {
	deleteEvents(db, ofType(id), () => db.prepare('DELETE FROM event_types WHERE id = ?').run(id));
}

export const categoryImpact = (db: Db, category: string) => impact(db, ofCategory(category));

/** Deletes all event types of a category, with all their events. */
export function deleteCategory(db: Db, category: string) {
	deleteEvents(db, ofCategory(category), () =>
		db.prepare('DELETE FROM event_types WHERE category = ?').run(category)
	);
}

function photosOf(db: Db, eventIds: number[]): string[] {
	const rows = db
		.prepare(
			`SELECT DISTINCT photo_id FROM event_photos WHERE event_id IN (${eventIds.map(() => '?').join(',')})`
		)
		.all(...eventIds) as { photo_id: string }[];
	return rows.map((r) => r.photo_id);
}

function orphaned(db: Db, photoIds: string[]): string[] {
	const used = db.prepare('SELECT 1 FROM event_photos WHERE photo_id = ? LIMIT 1');
	return photoIds.filter((p) => !used.get(p));
}

export function batchPlantIds(db: Db, batchId: string): string[] {
	const rows = db
		.prepare('SELECT plant_id FROM events WHERE batch_id = ? ORDER BY id')
		.all(batchId) as {
		plant_id: string;
	}[];
	return rows.map((r) => r.plant_id);
}
