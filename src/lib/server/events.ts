import { randomUUID } from 'node:crypto';
import type { EventFile } from '../files.ts';
import { isFirstChange, replaced, unsaved } from '../domain/propertyHistory.ts';
import { KEEP, type DiaryEvent, type FieldEntry, type RecordedField } from '../types.ts';
import { transaction, type Db } from './db.ts';
import { roleOf, useField } from './fields.ts';
import { deleteFiles } from './files.ts';
import { normalize } from '../suggest.ts';
import { attrHistory, forgetInitialValue, pinCover, setInitialValue } from './objects.ts';

type Row = {
	id: number;
	object_id: number;
	object_name: string;
	type_id: number;
	type_name: string;
	category: string | null;
	milestone: number;
	date: string;
	note: string;
	batch_id: string | null;
	batch_size: number;
};

const SELECT = `
	SELECT e.id, e.object_id, p.name AS object_name, e.type_id, t.name AS type_name, c.name AS category,
		t.milestone, e.date, e.note, e.batch_id,
		CASE WHEN e.batch_id IS NULL THEN 1
			ELSE (SELECT count(*) FROM events b WHERE b.batch_id = e.batch_id) END AS batch_size
	FROM events e
	JOIN objects p ON p.id = e.object_id
	JOIN event_types t ON t.id = e.type_id
	LEFT JOIN categories c ON c.id = t.category_id`;

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
	add('c.name = ?', f.category);
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

export function lastFieldsByType(db: Db): Record<number, RecordedField[]> {
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
	const fields = new Map<number, RecordedField[]>();
	const files = new Map<number, EventFile[]>();

	const eventAttrs = db
		.prepare(
			`SELECT d.event_id, f.name AS key, d.value FROM event_details d JOIN fields f ON f.id = d.field_id
			WHERE d.event_id IN (${placeholders}) ORDER BY d.rowid`
		)
		.all(...ids) as { event_id: number; key: string; value: string }[];
	for (const a of eventAttrs)
		push(fields, a.event_id, { target: 'event' as const, key: a.key, value: a.value });

	const objectIds = [...new Set(rows.map((r) => r.object_id))];
	const histories = Object.fromEntries(objectIds.map((id) => [id, attrHistory(db, id)]));
	for (const r of rows) {
		const changes = Object.values(histories[r.object_id]).flatMap((values) =>
			values.flatMap((v) =>
				v.eventId === r.id && v.since !== null ? [{ v, replaced: replaced(values, v) }] : []
			)
		);
		changes.sort((a, b) => a.v.id - b.v.id);
		for (const { v, replaced } of changes) {
			push(fields, r.id, { target: 'object' as const, key: v.key, value: v.value, replaced });
		}
	}

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
	fields: FieldEntry[];
	fileIds: string[];
};

function writeDetails(db: Db, eventId: number, objectId: number, input: EventInput) {
	db.prepare('DELETE FROM event_details WHERE event_id = ?').run(eventId);
	db.prepare('DELETE FROM property_values WHERE event_id = ?').run(eventId);
	db.prepare('DELETE FROM event_files WHERE event_id = ?').run(eventId);
	const detail = db.prepare(
		'INSERT OR REPLACE INTO event_details (event_id, field_id, value) VALUES (?, ?, ?)'
	);
	const change = db.prepare(
		'INSERT INTO property_values (object_id, field_id, value, event_id) VALUES (?, ?, ?, ?)'
	);
	for (const f of input.fields) {
		if (!f.key || !f.value) continue;
		const field = useField(db, f.key, roleOf(f.target));
		if (field.role === 'property') {
			change.run(objectId, field.id, f.value, eventId);
			const initial = f.target === 'object' ? f.initial : KEEP;
			if (initial.kind === 'keep') continue;
			const history = attrHistory(db, objectId)[f.key] ?? [];
			if (!isFirstChange(replaced(history, unsaved(input.date), eventId))) continue;
			if (initial.kind === 'unknown') forgetInitialValue(db, objectId, f.key);
			else setInitialValue(db, objectId, f.key, initial.value);
		} else {
			detail.run(eventId, field.id, f.value);
		}
	}
	const photo = db.prepare(
		'INSERT OR IGNORE INTO event_files (event_id, file_id, position) VALUES (?, ?, ?)'
	);
	input.fileIds.forEach((id, i) => photo.run(eventId, id, i));
	if (input.fileIds.length) pinCover(db, objectId);
}

function learnFields(db: Db, typeId: number, fields: FieldEntry[]) {
	const learn = db.prepare(
		`INSERT OR IGNORE INTO event_type_fields (type_id, field_id, position)
		SELECT ?1, id, (SELECT coalesce(max(position) + 1, 0) FROM event_type_fields WHERE type_id = ?1)
		FROM fields WHERE name = ?2`
	);
	for (const f of fields) if (f.key) learn.run(typeId, f.key);
}

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
		return ids;
	});
}

/** Returns the files no event references any more. */
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
		if (targets.length === 1) {
			db.prepare('UPDATE events SET object_id = ? WHERE id = ?').run(input.objectId, id);
		}
		const update = db.prepare('UPDATE events SET type_id = ?, date = ?, note = ? WHERE id = ?');
		for (const t of targets) {
			update.run(input.typeId, input.date, input.note, t.id);
			writeDetails(db, t.id, t.object_id, input);
		}
		learnFields(db, input.typeId, input.fields);
		return orphaned(db, before);
	});
}

// `where` is interpolated into SQL, so it only ever comes from the constructors below.
type Selection = { where: string; param: string | number };
const ofEvent = (id: number): Selection => ({ where: 'id = ?', param: id });
const ofObject = (id: number): Selection => ({ where: 'object_id = ?', param: id });
const ofType = (id: number): Selection => ({ where: 'type_id = ?', param: id });
const ofCategory = (category: string): Selection => ({
	where: `type_id IN (SELECT id FROM event_types
		WHERE category_id = (SELECT id FROM categories WHERE name = ?))`,
	param: category
});

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

/** Object attributes the events set fall back to their previous value by ON DELETE CASCADE. */
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

export function deleteObject(db: Db, id: number) {
	deleteEvents(db, ofObject(id), () => db.prepare('DELETE FROM objects WHERE id = ?').run(id));
}

export const typeImpact = (db: Db, id: number) => impact(db, ofType(id));

export function deleteType(db: Db, id: number) {
	deleteEvents(db, ofType(id), () => db.prepare('DELETE FROM event_types WHERE id = ?').run(id));
}

export const categoryImpact = (db: Db, category: string) => impact(db, ofCategory(category));

export function deleteCategory(db: Db, category: string) {
	deleteEvents(db, ofCategory(category), () =>
		db
			.prepare(
				'DELETE FROM event_types WHERE category_id = (SELECT id FROM categories WHERE name = ?)'
			)
			.run(category)
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
