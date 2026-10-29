import { randomUUID } from 'node:crypto';
import type { EventFile } from '../files.ts';
import type { DiaryEvent, Field, FieldTemplate } from '../types.ts';
import { transaction, type Db } from './db.ts';
import { getType } from './eventTypes.ts';
import { deleteFiles } from './files.ts';
import { normalize } from '../suggest.ts';
import { forgetInitialValue, pinCover, promoteToProperties, setInitialValue } from './objects.ts';

type Row = {
	id: number;
	object_id: number;
	object_name: string;
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
	SELECT e.id, e.object_id, p.name AS object_name, e.type_id, t.name AS type_name, t.category,
		t.milestone, e.date, e.note, e.batch_id,
		CASE WHEN e.batch_id IS NULL THEN 1
			ELSE (SELECT count(*) FROM events b WHERE b.batch_id = e.batch_id) END AS batch_size
	FROM events e
	JOIN objects p ON p.id = e.object_id
	JOIN event_types t ON t.id = e.type_id`;

export type EventFilter = {
	objectId?: number;
	typeId?: number;
	category?: string;
	from?: string;
	to?: string;
	/** Words that must all occur in the event's type name or note. */
	search?: string;
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
	add('e.object_id = ?', f.objectId);
	add('e.type_id = ?', f.typeId);
	add('t.category = ?', f.category);
	add('e.date >= ?', f.from);
	add('e.date <= ?', f.to);
	for (const word of normalize(f.search ?? '')
		.split(' ')
		.filter(Boolean)) {
		add("instr(normalized(t.name || ' ' || e.note), ?) > 0", word);
	}
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
	const files = new Map<number, EventFile[]>();

	const eventAttrs = db
		.prepare(
			`SELECT event_id, key, value FROM event_attrs WHERE event_id IN (${placeholders}) ORDER BY rowid`
		)
		.all(...ids) as { event_id: number; key: string; value: string }[];
	for (const a of eventAttrs)
		push(fields, a.event_id, { key: a.key, value: a.value, target: 'event' as const });

	// With the value each change replaced: the one before it in the property's history.
	const objectAttrs = db
		.prepare(
			`SELECT * FROM (
				SELECT id, event_id, key, value,
					lag(id) OVER w AS before_id, lag(value) OVER w AS before,
					lag(since) OVER w AS before_since
				FROM object_attrs
				WHERE object_id IN (SELECT object_id FROM events WHERE id IN (${placeholders}))
				WINDOW w AS (PARTITION BY object_id, key ORDER BY coalesce(since, ''), id)
			) WHERE event_id IN (${placeholders}) ORDER BY id`
		)
		.all(...ids, ...ids) as {
		event_id: number;
		key: string;
		value: string;
		before_id: number | null;
		before: string | null;
		before_since: string | null;
	}[];
	for (const a of objectAttrs)
		push(fields, a.event_id, {
			key: a.key,
			value: a.value,
			target: 'object' as const,
			before: a.before,
			firstChange: a.before_id === null || a.before_since === null
		});

	const links = db
		.prepare(
			`SELECT ef.event_id, f.id, f.mime, f.original_name AS name
			FROM event_files ef JOIN files f ON f.id = ef.file_id
			WHERE ef.event_id IN (${placeholders}) ORDER BY ef.position`
		)
		.all(...ids) as ({ event_id: number } & EventFile)[];
	for (const { event_id, id, mime, name } of links) push(files, event_id, { id, mime, name });

	return rows.map((r) => ({
		id: r.id,
		objectId: r.object_id,
		objectName: r.object_name,
		typeId: r.type_id,
		typeName: r.type_name,
		category: r.category,
		milestone: !!r.milestone,
		date: r.date,
		note: r.note,
		batchId: r.batch_id,
		batchSize: r.batch_size,
		fields: fields.get(r.id) ?? [],
		files: files.get(r.id) ?? []
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
	fileIds: string[];
};

function writeDetails(db: Db, eventId: number, objectId: number, input: EventInput) {
	db.prepare('DELETE FROM event_attrs WHERE event_id = ?').run(eventId);
	db.prepare('DELETE FROM object_attrs WHERE event_id = ?').run(eventId);
	db.prepare('DELETE FROM event_files WHERE event_id = ?').run(eventId);
	const eventAttr = db.prepare(
		'INSERT OR REPLACE INTO event_attrs (event_id, key, value) VALUES (?, ?, ?)'
	);
	const objectAttr = db.prepare(
		'INSERT INTO object_attrs (object_id, key, value, since, event_id) VALUES (?, ?, ?, ?, ?)'
	);
	for (const f of input.fields) {
		if (!f.key || !f.value) continue;
		if (f.target === 'object') {
			objectAttr.run(objectId, f.key, f.value, input.date, eventId);
			const change = { date: input.date, eventId };
			if (f.previous === null) forgetInitialValue(db, objectId, f.key, change);
			else if (f.previous) setInitialValue(db, objectId, f.key, f.previous, change);
		} else {
			eventAttr.run(eventId, f.key, f.value);
		}
	}
	const photo = db.prepare(
		'INSERT OR IGNORE INTO event_files (event_id, file_id, position) VALUES (?, ?, ?)'
	);
	input.fileIds.forEach((id, i) => photo.run(eventId, id, i));
	if (input.fileIds.length) pinCover(db, objectId);
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

/** One event per object; several objects form a batch that can be corrected together. */
export function createEvents(db: Db, objectIds: number[], input: EventInput): number[] {
	return transaction(db, () => {
		const batchId = objectIds.length > 1 ? randomUUID() : null;
		const insert = db.prepare(
			'INSERT INTO events (object_id, type_id, date, note, batch_id) VALUES (?, ?, ?, ?, ?)'
		);
		const ids = objectIds.map((objectId) => {
			const id = Number(
				insert.run(objectId, input.typeId, input.date, input.note, batchId).lastInsertRowid
			);
			writeDetails(db, id, objectId, input);
			return id;
		});
		learnFields(db, input.typeId, input.fields);
		promoteToProperties(db);
		return ids;
	});
}

/**
 * Updates an event, or all events of its batch. The object can only be changed for a
 * single event. Returns files that are no longer referenced.
 */
export function updateEvent(
	db: Db,
	id: number,
	input: EventInput & { objectId: number },
	applyToBatch: boolean
): string[] {
	return transaction(db, () => {
		const event = getEvent(db, id);
		if (!event) throw new Error(`Event ${id} not found`);
		const targets =
			applyToBatch && event.batchId
				? (db.prepare('SELECT id, object_id FROM events WHERE batch_id = ?').all(event.batchId) as {
						id: number;
						object_id: number;
					}[])
				: [{ id, object_id: input.objectId }];
		const before = filesOf(
			db,
			targets.map((t) => t.id)
		);
		const update = db.prepare('UPDATE events SET type_id = ?, date = ?, note = ? WHERE id = ?');
		for (const t of targets) {
			update.run(input.typeId, input.date, input.note, t.id);
			writeDetails(db, t.id, t.object_id, input);
		}
		if (targets.length === 1) {
			db.prepare('UPDATE events SET object_id = ? WHERE id = ?').run(input.objectId, id);
		}
		learnFields(db, input.typeId, input.fields);
		promoteToProperties(db);
		return orphaned(db, before);
	});
}

// Events to delete, as a condition on `events`. The SQL is fixed here; only the
// parameter comes from outside.
type Selection = { where: string; param: string | number };
const ofEvent = (id: number): Selection => ({ where: 'id = ?', param: id });
const ofObject = (id: number): Selection => ({ where: 'object_id = ?', param: id });
const ofType = (id: number): Selection => ({ where: 'type_id = ?', param: id });
const ofCategory = (category: string): Selection => ({
	where: 'type_id IN (SELECT id FROM event_types WHERE category = ?)',
	param: category
});

/** What a deletion takes along: the events, and the files no other event uses. */
export type Impact = { events: number; files: number };

function impact(db: Db, { where, param }: Selection): Impact {
	return db
		.prepare(
			`WITH doomed AS (SELECT id FROM events WHERE ${where})
			SELECT (SELECT count(*) FROM doomed) AS events,
				(SELECT count(DISTINCT file_id) FROM event_files
				WHERE event_id IN doomed AND file_id NOT IN (
					SELECT file_id FROM event_files WHERE event_id NOT IN doomed)) AS files`
		)
		.get(param) as Impact;
}

/**
 * Deletes the selected events and runs `then` in the same transaction. Photos go along
 * unless another event still uses them; object attributes the events set fall back to
 * their previous value.
 */
function deleteEvents(db: Db, { where, param }: Selection, then = () => {}) {
	const orphans = transaction(db, () => {
		const before = (
			db
				.prepare(
					`SELECT DISTINCT file_id FROM event_files
					WHERE event_id IN (SELECT id FROM events WHERE ${where})`
				)
				.all(param) as { file_id: string }[]
		).map((r) => r.file_id);
		db.prepare(`DELETE FROM events WHERE ${where}`).run(param);
		then();
		return orphaned(db, before);
	});
	deleteFiles(db, orphans);
}

export function deleteEvent(db: Db, id: number) {
	deleteEvents(db, ofEvent(id));
}

export const objectImpact = (db: Db, id: number) => impact(db, ofObject(id));

/** Deletes an object with all its events. Events of other objects stay as they are. */
export function deleteObject(db: Db, id: number) {
	deleteEvents(db, ofObject(id), () => db.prepare('DELETE FROM objects WHERE id = ?').run(id));
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

function filesOf(db: Db, eventIds: number[]): string[] {
	const rows = db
		.prepare(
			`SELECT DISTINCT file_id FROM event_files WHERE event_id IN (${eventIds.map(() => '?').join(',')})`
		)
		.all(...eventIds) as { file_id: string }[];
	return rows.map((r) => r.file_id);
}

function orphaned(db: Db, fileIds: string[]): string[] {
	const used = db.prepare('SELECT 1 FROM event_files WHERE file_id = ? LIMIT 1');
	return fileIds.filter((p) => !used.get(p));
}

export function batchObjectIds(db: Db, batchId: string): number[] {
	const rows = db
		.prepare('SELECT object_id FROM events WHERE batch_id = ? ORDER BY id')
		.all(batchId) as {
		object_id: number;
	}[];
	return rows.map((r) => r.object_id);
}
