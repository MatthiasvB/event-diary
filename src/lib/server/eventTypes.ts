import type { EventType, EventTypeStats, FieldTemplate } from '../types.ts';
import type { Db } from './db.ts';

type Row = {
	id: number;
	name: string;
	category: string;
	milestone: number;
	hint: string;
	fields: string;
};

function fromRow(r: Row): EventType {
	return {
		id: r.id,
		name: r.name,
		category: r.category,
		milestone: !!r.milestone,
		hint: r.hint,
		fields: JSON.parse(r.fields) as FieldTemplate[]
	};
}

export function listTypes(db: Db): EventTypeStats[] {
	const rows = db
		.prepare(
			`SELECT t.*, count(e.id) AS count, max(e.date) AS last
			FROM event_types t LEFT JOIN events e ON e.type_id = t.id
			GROUP BY t.id ORDER BY t.category, t.name`
		)
		.all() as (Row & { count: number; last: string | null })[];
	return rows.map((r) => ({ ...fromRow(r), count: r.count, last: r.last }));
}

export function getType(db: Db, id: number): EventType | undefined {
	const row = db.prepare('SELECT * FROM event_types WHERE id = ?').get(id) as Row | undefined;
	return row && fromRow(row);
}

export function findTypeByName(db: Db, name: string): EventType | undefined {
	const row = db.prepare('SELECT * FROM event_types WHERE name = ?').get(name) as Row | undefined;
	return row && fromRow(row);
}

/** Returns the type with this name, creating it (as typed in the event form) if needed. */
export function ensureType(
	db: Db,
	name: string,
	init: Partial<Omit<EventType, 'id'>> = {}
): EventType {
	const existing = findTypeByName(db, name);
	if (existing) return existing;
	const { lastInsertRowid } = db
		.prepare(
			'INSERT INTO event_types (name, category, milestone, hint, fields) VALUES (?, ?, ?, ?, ?)'
		)
		.run(
			name,
			init.category ?? '',
			init.milestone ? 1 : 0,
			init.hint ?? '',
			JSON.stringify(init.fields ?? [])
		);
	return getType(db, Number(lastInsertRowid))!;
}

export function updateType(db: Db, t: Omit<EventType, 'name'>) {
	db.prepare(
		'UPDATE event_types SET category = ?, milestone = ?, hint = ?, fields = ? WHERE id = ?'
	).run(t.category, t.milestone ? 1 : 0, t.hint, JSON.stringify(t.fields), t.id);
}

/** Deletes an unused type. Returns false if events still use it. */
export function deleteType(db: Db, id: number): boolean {
	const used = db.prepare('SELECT 1 FROM events WHERE type_id = ? LIMIT 1').get(id);
	if (used) return false;
	db.prepare('DELETE FROM event_types WHERE id = ?').run(id);
	return true;
}
