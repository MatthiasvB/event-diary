import { t } from '../i18n.ts';
import type { EventType, EventTypeStats, FieldTemplate } from '../types.ts';
import type { Db } from './db.ts';
import { getSetting, setSetting } from './settings.ts';

export const PHOTO_TYPE_SETTING = 'photoTypeId';

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

export function findType(db: Db, name: string, category: string): EventType | undefined {
	const row = db
		.prepare('SELECT * FROM event_types WHERE name = ? AND category = ?')
		.get(name, category) as Row | undefined;
	return row && fromRow(row);
}

export function ensureType(
	db: Db,
	name: string,
	init: Partial<Omit<EventType, 'id'>> = {}
): EventType {
	const existing = findType(db, name, init.category ?? '');
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

/** False if the new category already has a type of that name. */
export function updateType(db: Db, t: Omit<EventType, 'name'>): boolean {
	const clash = db
		.prepare(
			`SELECT 1 FROM event_types o JOIN event_types s ON s.id = ?
			WHERE o.name = s.name AND o.category = ? AND o.id != s.id`
		)
		.get(t.id, t.category);
	if (clash) return false;
	db.prepare(
		'UPDATE event_types SET category = ?, milestone = ?, hint = ?, fields = ? WHERE id = ?'
	).run(t.category, t.milestone ? 1 : 0, t.hint, JSON.stringify(t.fields), t.id);
	return true;
}

/** Remembered by ID, so it can be renamed freely. */
export function photoType(db: Db): EventType {
	const id = getSetting<number>(db, PHOTO_TYPE_SETTING);
	const stored = id === undefined ? undefined : getType(db, id);
	if (stored) return stored;
	const type = ensureType(db, t.events.photoType, { category: t.events.photoTypeCategory });
	setSetting(db, PHOTO_TYPE_SETTING, type.id);
	return type;
}
