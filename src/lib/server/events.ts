import type { EventFile } from '../files.ts';
import { isFirstChange, replaced, unsaved } from '../domain/propertyHistory.ts';
import {
	KEEP,
	type DiaryEvent,
	type EventObject,
	type FieldEntry,
	type RecordedField
} from '../types.ts';
import { transaction, type Db } from './db.ts';
import { roleOf, useField } from './fields.ts';
import { deleteFiles } from './files.ts';
import { normalize } from '../suggest.ts';
import { attrHistory, forgetInitialValue, pinCover, setInitialValue } from './objects.ts';

type Row = {
	id: number;
	type_id: number;
	type_name: string;
	category: string | null;
	milestone: number;
	date: string;
	note: string;
};

const SELECT = `
	SELECT e.id, e.type_id, t.name AS type_name, c.name AS category, t.milestone, e.date, e.note
	FROM events e
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
	add('e.id IN (SELECT event_id FROM event_objects WHERE object_id = ?)', f.objectId);
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

	const objects = new Map<number, EventObject[]>();
	const memberships = db
		.prepare(
			`SELECT eo.event_id, o.id, o.name FROM event_objects eo JOIN objects o ON o.id = eo.object_id
			WHERE eo.event_id IN (${placeholders}) ORDER BY o.name, o.id`
		)
		.all(...ids) as ({ event_id: number } & EventObject)[];
	for (const { event_id, id, name } of memberships) push(objects, event_id, { id, name });

	const histories = new Map<number, ReturnType<typeof attrHistory>>();
	for (const r of rows) {
		const changes = (objects.get(r.id) ?? []).flatMap((o) => {
			if (!histories.has(o.id)) histories.set(o.id, attrHistory(db, o.id));
			return Object.values(histories.get(o.id) ?? {}).flatMap((values) =>
				values.flatMap((v) =>
					v.eventId === r.id && v.since !== null
						? [{ v, objectId: o.id, replaced: replaced(values, v) }]
						: []
				)
			);
		});
		changes.sort((a, b) => a.v.id - b.v.id);
		for (const { v, objectId, replaced } of changes) {
			push(fields, r.id, {
				target: 'object' as const,
				key: v.key,
				value: v.value,
				objectId,
				replaced
			});
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
		objects: objects.get(r.id) ?? [],
		typeId: r.type_id,
		typeName: r.type_name,
		category: r.category,
		milestone: !!r.milestone,
		date: r.date,
		note: r.note,
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

function writeDetails(db: Db, eventId: number, objectIds: number[], input: EventInput) {
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
		if (field.role === 'detail') {
			detail.run(eventId, field.id, f.value);
			continue;
		}
		const initial = f.target === 'object' ? f.initial : KEEP;
		for (const objectId of objectIds) {
			change.run(objectId, field.id, f.value, eventId);
			if (initial.kind === 'keep') continue;
			const history = attrHistory(db, objectId)[f.key] ?? [];
			if (!isFirstChange(replaced(history, unsaved(input.date), eventId))) continue;
			if (initial.kind === 'unknown') forgetInitialValue(db, objectId, f.key);
			else setInitialValue(db, objectId, f.key, initial.value);
		}
	}
	const photo = db.prepare(
		'INSERT OR IGNORE INTO event_files (event_id, file_id, position) VALUES (?, ?, ?)'
	);
	input.fileIds.forEach((id, i) => photo.run(eventId, id, i));
	if (input.fileIds.length) for (const objectId of objectIds) pinCover(db, objectId);
}

function learnFields(db: Db, typeId: number, fields: FieldEntry[]) {
	const learn = db.prepare(
		`INSERT OR IGNORE INTO event_type_fields (type_id, field_id, position)
		SELECT ?1, id, (SELECT coalesce(max(position) + 1, 0) FROM event_type_fields WHERE type_id = ?1)
		FROM fields WHERE name = ?2`
	);
	for (const f of fields) if (f.key) learn.run(typeId, f.key);
}

export function createEvent(db: Db, objectIds: number[], input: EventInput): number {
	return transaction(db, () => {
		const { id } = db
			.prepare('INSERT INTO events (type_id, date, note) VALUES (?, ?, ?) RETURNING id')
			.get(input.typeId, input.date, input.note) as { id: number };
		const member = db.prepare('INSERT INTO event_objects (event_id, object_id) VALUES (?, ?)');
		for (const objectId of objectIds) member.run(id, objectId);
		writeDetails(db, id, objectIds, input);
		learnFields(db, input.typeId, input.fields);
		return id;
	});
}

/**
 * Edits the whole event, or with `only`, what it is for that one of its objects: the object
 * leaves the event, and the edit becomes an event of its own. Returns the files no event
 * references any more.
 */
export function updateEvent(
	db: Db,
	id: number,
	input: EventInput & { objectIds: number[] },
	only: number | null
): string[] {
	return transaction(db, () => {
		if (only !== null && ownsPart(db, id, only)) {
			db.prepare('DELETE FROM event_objects WHERE event_id = ? AND object_id = ?').run(id, only);
			createEvent(db, input.objectIds, input);
			return [];
		}
		const before = filesOf(db, [id]);
		db.prepare('UPDATE events SET type_id = ?, date = ?, note = ? WHERE id = ?').run(
			input.typeId,
			input.date,
			input.note,
			id
		);
		const member = db.prepare(
			'INSERT OR IGNORE INTO event_objects (event_id, object_id) VALUES (?, ?)'
		);
		for (const objectId of input.objectIds) member.run(id, objectId);
		db.prepare(
			'DELETE FROM event_objects WHERE event_id = ? AND object_id NOT IN (SELECT value FROM json_each(?))'
		).run(id, JSON.stringify(input.objectIds));
		writeDetails(db, id, input.objectIds, input);
		learnFields(db, input.typeId, input.fields);
		return orphaned(db, before);
	});
}

/** The object belongs to the event, and so does another one. */
function ownsPart(db: Db, eventId: number, objectId: number): boolean {
	return !!db
		.prepare(
			`SELECT 1 FROM event_objects WHERE event_id = ?1 AND object_id = ?2
			AND EXISTS (SELECT 1 FROM event_objects WHERE event_id = ?1 AND object_id != ?2)`
		)
		.get(eventId, objectId);
}

// `where` is interpolated into SQL, so it only ever comes from the constructors below.
type Selection = { where: string; param: string | number };
const ofEvent = (id: number): Selection => ({ where: 'id = ?', param: id });
const ofObject = (id: number): Selection => ({
	where: `id IN (SELECT event_id FROM event_objects WHERE object_id = ?1)
		AND id NOT IN (SELECT event_id FROM event_objects WHERE object_id != ?1)`,
	param: id
});
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

/** With `only`, that object leaves the event, and the event stays for the others. */
export function deleteEvent(db: Db, id: number, only: number | null = null) {
	if (only !== null && ownsPart(db, id, only)) {
		db.prepare('DELETE FROM event_objects WHERE event_id = ? AND object_id = ?').run(id, only);
		return;
	}
	deleteEvents(db, ofEvent(id));
}

export const objectImpact = (db: Db, id: number) => impact(db, ofObject(id));

/** Events it shares with other objects stay for those. */
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
