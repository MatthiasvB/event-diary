import { t } from '../i18n.ts';
import type { EventType, EventTypeStats, FieldTemplate } from '../types.ts';
import { transaction, type Db } from './db.ts';
import { roleOf, targetOf, useField, type Role } from './fields.ts';

type Row = {
	id: number;
	name: string;
	category: string | null;
	milestone: number;
	hint: string;
};

const SELECT = `SELECT t.id, t.name, c.name AS category, t.milestone, t.hint
	FROM event_types t LEFT JOIN categories c ON c.id = t.category_id`;

function templates(db: Db): Map<number, FieldTemplate[]> {
	const rows = db
		.prepare(
			`SELECT tf.type_id, f.name, f.role, tf.default_value
			FROM event_type_fields tf JOIN fields f ON f.id = tf.field_id
			ORDER BY tf.type_id, tf.position`
		)
		.all() as { type_id: number; name: string; role: Role; default_value: string | null }[];
	const result = new Map<number, FieldTemplate[]>();
	for (const r of rows) {
		const list = result.get(r.type_id) ?? [];
		list.push({
			key: r.name,
			target: targetOf(r.role),
			...(r.default_value === null ? {} : { default: r.default_value })
		});
		result.set(r.type_id, list);
	}
	return result;
}

function fromRow(r: Row, fields: Map<number, FieldTemplate[]>): EventType {
	return {
		id: r.id,
		name: r.name,
		category: r.category,
		milestone: !!r.milestone,
		hint: r.hint,
		fields: fields.get(r.id) ?? []
	};
}

function setTemplates(db: Db, typeId: number, fields: FieldTemplate[]) {
	db.prepare('DELETE FROM event_type_fields WHERE type_id = ?').run(typeId);
	const insert = db.prepare(
		`INSERT OR IGNORE INTO event_type_fields (type_id, field_id, position, default_value)
		VALUES (?, ?, ?, ?)`
	);
	fields.forEach((f, i) =>
		insert.run(typeId, useField(db, f.key, roleOf(f.target)).id, i, f.default || null)
	);
}

export function listTypes(db: Db): EventTypeStats[] {
	const rows = db
		.prepare(
			`SELECT x.*, count(e.id) AS count, max(e.date) AS last
			FROM (${SELECT}) x LEFT JOIN events e ON e.type_id = x.id
			GROUP BY x.id ORDER BY x.category, x.name`
		)
		.all() as (Row & { count: number; last: string | null })[];
	const fields = templates(db);
	return rows.map((r) => ({ ...fromRow(r, fields), count: r.count, last: r.last }));
}

export function getType(db: Db, id: number): EventType | undefined {
	const row = db.prepare(`${SELECT} WHERE t.id = ?`).get(id) as Row | undefined;
	return row && fromRow(row, templates(db));
}

export function findType(db: Db, name: string, category: string | null): EventType | undefined {
	const row = db.prepare(`${SELECT} WHERE t.name = ? AND c.name IS ?`).get(name, category) as
		Row | undefined;
	return row && fromRow(row, templates(db));
}

function useCategory(db: Db, name: string | null): number | null {
	if (name === null) return null;
	const row = db
		.prepare(
			'INSERT INTO categories (name) VALUES (?) ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id'
		)
		.get(name) as { id: number };
	return row.id;
}

export function ensureType(
	db: Db,
	name: string,
	init: Partial<Omit<EventType, 'id' | 'name'>> = {}
): EventType {
	return transaction(db, () => {
		const category = init.category ?? null;
		const existing = findType(db, name, category);
		if (existing) return existing;
		const row = db
			.prepare(
				`INSERT INTO event_types (name, category_id, milestone, hint) VALUES (?, ?, ?, ?)
				RETURNING id, name, ? AS category, milestone, hint`
			)
			.get(
				name,
				useCategory(db, category),
				init.milestone ? 1 : 0,
				init.hint ?? '',
				category
			) as Row;
		setTemplates(db, row.id, init.fields ?? []);
		return fromRow(row, templates(db));
	});
}

/** False if the new category already has a type of that name. */
export function updateType(db: Db, t: Omit<EventType, 'name'>): boolean {
	return transaction(db, () => {
		const clash = db
			.prepare(
				`SELECT 1 FROM event_types o JOIN event_types s ON s.id = ?
				LEFT JOIN categories c ON c.id = o.category_id
				WHERE o.name = s.name AND c.name IS ? AND o.id != s.id`
			)
			.get(t.id, t.category);
		if (clash) return false;
		db.prepare('UPDATE event_types SET category_id = ?, milestone = ?, hint = ? WHERE id = ?').run(
			useCategory(db, t.category),
			t.milestone ? 1 : 0,
			t.hint,
			t.id
		);
		setTemplates(db, t.id, t.fields);
		return true;
	});
}

export function findPhotoType(db: Db): EventType | undefined {
	const row = db.prepare(`${SELECT} WHERE t.photo_default`).get() as Row | undefined;
	return row && fromRow(row, templates(db));
}

/** Marked in its row, so it can be renamed freely. */
export function photoType(db: Db): EventType {
	return transaction(db, () => {
		const stored = findPhotoType(db);
		if (stored) return stored;
		const type = ensureType(db, t.events.photoType, { category: t.events.photoTypeCategory });
		db.prepare('UPDATE event_types SET photo_default = 1 WHERE id = ?').run(type.id);
		return type;
	});
}
