import type { Candidate } from '../suggest.ts';
import type { FieldTarget, ValueCandidate, Vocabulary } from '../types.ts';
import { transaction, type Db } from './db.ts';
import { listTypes, PHOTO_TYPE_SETTING } from './eventTypes.ts';
import { propertyKeys, useField, type Role } from './fields.ts';
import { getSetting, setOverviewColumns, setSetting, type OverviewColumn } from './settings.ts';

type UsageRow = {
	key: string;
	value: string;
	type_id: number | null;
	n: number;
	last: string | null;
};

function collect(map: Map<string, ValueCandidate>, value: string, r: UsageRow) {
	const c = map.get(value) ?? { value, count: 0, last: null, byType: {} };
	c.count += r.n;
	if (r.last && (!c.last || r.last > c.last)) c.last = r.last;
	if (r.type_id !== null) c.byType[r.type_id] = (c.byType[r.type_id] ?? 0) + r.n;
	map.set(value, c);
}

export function vocabulary(db: Db): Vocabulary {
	const eventRows = db
		.prepare(
			`SELECT f.name AS key, d.value, e.type_id, count(*) AS n, max(e.date) AS last
			FROM event_details d JOIN fields f ON f.id = d.field_id JOIN events e ON e.id = d.event_id
			GROUP BY f.id, d.value, e.type_id`
		)
		.all() as UsageRow[];
	const objectRows = db
		.prepare(
			`SELECT f.name AS key, a.value, e.type_id, count(*) AS n, max(a.since) AS last
			FROM object_attrs a JOIN fields f ON f.id = a.field_id
			LEFT JOIN events e ON e.id = a.event_id
			GROUP BY f.id, a.value, e.type_id`
		)
		.all() as UsageRow[];

	const values = new Map<string, Map<string, ValueCandidate>>();
	const keys: Record<FieldTarget, Map<string, ValueCandidate>> = {
		event: new Map(),
		object: new Map()
	};
	for (const [target, rows] of [
		['event', eventRows],
		['object', objectRows]
	] as const) {
		for (const r of rows) {
			if (!values.has(r.key)) values.set(r.key, new Map());
			collect(values.get(r.key)!, r.value, r);
			collect(keys[target], r.key, r);
		}
	}
	for (const name of propertyKeys(db)) {
		if (!keys.object.has(name))
			keys.object.set(name, { value: name, count: 0, last: null, byType: {} });
	}

	const categories = db
		.prepare(
			`SELECT t.category AS value, count(e.id) AS count, max(e.date) AS last
			FROM event_types t LEFT JOIN events e ON e.type_id = t.id
			WHERE t.category != '' GROUP BY t.category`
		)
		.all() as Pick<Candidate, 'value' | 'count' | 'last'>[];

	return {
		types: listTypes(db),
		categories: categories.map((c) => ({ ...c })),
		keys: { event: [...keys.event.values()], object: [...keys.object.values()] },
		values: Object.fromEntries([...values].map(([k, m]) => [k, [...m.values()]]))
	};
}

export type ValueKind =
	{ kind: 'category' } | { kind: 'type' } | { kind: 'key' } | { kind: 'value'; key: string };

/** Merges into `to` if it exists. Returns the number of affected records. */
export function rename(db: Db, what: ValueKind, from: string, to: string): number {
	to = to.trim();
	if (!to || from === to) return 0;
	return transaction(db, () => {
		switch (what.kind) {
			case 'category':
				return renameCategory(db, from, to);
			case 'type':
				return renameType(db, from, to);
			case 'key':
				return renameKey(db, from, to);
			case 'value':
				return renameValue(db, what.key, from, to);
		}
	});
}

function renameValue(db: Db, key: string, from: string, to: string): number {
	const field = '(SELECT id FROM fields WHERE name = ?)';
	const a = db
		.prepare(`UPDATE event_details SET value = ? WHERE field_id = ${field} AND value = ?`)
		.run(to, key, from);
	const b = db
		.prepare(`UPDATE object_attrs SET value = ? WHERE field_id = ${field} AND value = ?`)
		.run(to, key, from);
	db.prepare(
		`UPDATE event_type_fields SET default_value = ? WHERE field_id = ${field} AND default_value = ?`
	).run(to, key, from);
	return Number(a.changes) + Number(b.changes);
}

type FieldRow = { id: number; role: Role };

function renameKey(db: Db, from: string, to: string): number {
	const find = db.prepare('SELECT id, role FROM fields WHERE name = ?');
	const source = find.get(from) as FieldRow | undefined;
	if (!source) return 0;
	const uses = db
		.prepare(
			`SELECT (SELECT count(*) FROM event_details WHERE field_id = ?1)
				+ (SELECT count(*) FROM object_attrs WHERE field_id = ?1) AS n`
		)
		.get(source.id) as { n: number };
	const existing = find.get(to) as FieldRow | undefined;
	if (!existing) {
		db.prepare('UPDATE fields SET name = ? WHERE id = ?').run(to, source.id);
		return uses.n;
	}
	const role: Role = source.role === 'property' ? 'property' : existing.role;
	const target = useField(db, to, role);
	useField(db, from, role);

	// An event that has both keeps both values, joined.
	const both = db
		.prepare(
			`SELECT s.event_id, s.value AS source, d.value AS dest FROM event_details s
			JOIN event_details d ON d.event_id = s.event_id AND d.field_id = ? WHERE s.field_id = ?`
		)
		.all(target.id, source.id) as { event_id: number; source: string; dest: string }[];
	for (const r of both) {
		const joined = r.dest === r.source ? r.dest : `${r.dest} / ${r.source}`;
		db.prepare('UPDATE event_details SET value = ? WHERE event_id = ? AND field_id = ?').run(
			joined,
			r.event_id,
			target.id
		);
		db.prepare('DELETE FROM event_details WHERE event_id = ? AND field_id = ?').run(
			r.event_id,
			source.id
		);
	}
	db.prepare('UPDATE event_details SET field_id = ? WHERE field_id = ?').run(target.id, source.id);
	db.prepare('UPDATE object_attrs SET field_id = ? WHERE field_id = ?').run(target.id, source.id);
	db.prepare('UPDATE OR IGNORE event_type_fields SET field_id = ? WHERE field_id = ?').run(
		target.id,
		source.id
	);
	db.prepare('DELETE FROM event_type_fields WHERE field_id = ?').run(source.id);
	// The kind goes along, unless the name merged into already has one. The earlier position
	// of the two is kept.
	db.prepare(
		`UPDATE fields SET
			kind = CASE WHEN fields.kind = 'text' THEN s.kind ELSE fields.kind END,
			unit = CASE WHEN fields.kind = 'text' THEN s.unit ELSE fields.unit END,
			position = CASE WHEN s.position IS NULL THEN fields.position
				WHEN fields.position IS NULL THEN s.position
				ELSE min(s.position, fields.position) END
		FROM fields s WHERE s.id = ? AND fields.id = ?`
	).run(source.id, target.id);
	db.prepare('DELETE FROM fields WHERE id = ?').run(source.id);
	return uses.n;
}

type TypeRow = { id: number; name: string; category: string };

function renameType(db: Db, from: string, to: string): number {
	const sources = db.prepare('SELECT * FROM event_types WHERE name = ?').all(from) as TypeRow[];
	return sources.reduce((n, s) => n + moveType(db, s, to, s.category), 0);
}

function renameCategory(db: Db, from: string, to: string): number {
	const sources = db.prepare('SELECT * FROM event_types WHERE category = ?').all(from) as TypeRow[];
	return sources.reduce((n, s) => n + moveType(db, s, s.name, to), 0);
}

function moveType(db: Db, source: TypeRow, name: string, category: string): number {
	const target = db
		.prepare('SELECT id FROM event_types WHERE name = ? AND category = ? AND id != ?')
		.get(name, category, source.id) as { id: number } | undefined;
	if (!target) {
		return Number(
			db
				.prepare('UPDATE event_types SET name = ?, category = ? WHERE id = ?')
				.run(name, category, source.id).changes
		);
	}
	const moved = db
		.prepare('UPDATE events SET type_id = ? WHERE type_id = ?')
		.run(target.id, source.id);
	db.prepare('DELETE FROM event_types WHERE id = ?').run(source.id);
	if (getSetting<number>(db, PHOTO_TYPE_SETTING) === source.id) {
		setSetting(db, PHOTO_TYPE_SETTING, target.id);
	}
	const columns = getSetting<OverviewColumn[]>(db, 'overviewColumns');
	if (columns) {
		setOverviewColumns(
			db,
			columns.map((c) => ({
				...c,
				typeIds: [...new Set(c.typeIds.map((id) => (id === source.id ? target.id : id)))]
			}))
		);
	}
	return Number(moved.changes) + 1;
}
