import type { Candidate } from '../suggest.ts';
import type { FieldTarget, FieldTemplate, ValueCandidate, Vocabulary } from '../types.ts';
import { transaction, type Db } from './db.ts';
import { listTypes, PHOTO_TYPE_SETTING } from './eventTypes.ts';
import { promoteToProperties } from './objects.ts';
import {
	getPropertyOrder,
	getSetting,
	setOverviewColumns,
	setPropertyOrder,
	setSetting,
	type OverviewColumn
} from './settings.ts';

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
			`SELECT a.key, a.value, e.type_id, count(*) AS n, max(e.date) AS last
			FROM event_attrs a JOIN events e ON e.id = a.event_id
			GROUP BY a.key, a.value, e.type_id`
		)
		.all() as UsageRow[];
	const objectRows = db
		.prepare(
			`SELECT a.key, a.value, e.type_id, count(*) AS n, max(a.since) AS last
			FROM object_attrs a JOIN objects p ON p.id = a.object_id LEFT JOIN events e ON e.id = a.event_id
			GROUP BY a.key, a.value, e.type_id`
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
			case 'key': {
				const n = renameKey(db, from, to);
				promoteToProperties(db);
				return n;
			}
			case 'value':
				return renameValue(db, what.key, from, to);
		}
	});
}

function renameValue(db: Db, key: string, from: string, to: string): number {
	const a = db
		.prepare('UPDATE event_attrs SET value = ? WHERE key = ? AND value = ?')
		.run(to, key, from);
	const b = db
		.prepare('UPDATE object_attrs SET value = ? WHERE key = ? AND value = ?')
		.run(to, key, from);
	updateTemplates(db, (f) => (f.key === key && f.default === from ? { ...f, default: to } : f));
	return Number(a.changes) + Number(b.changes);
}

function renameKey(db: Db, from: string, to: string): number {
	// An event that has both keys keeps both values, joined.
	const both = db
		.prepare(
			`SELECT s.event_id, s.value AS source, d.value AS dest FROM event_attrs s
			JOIN event_attrs d ON d.event_id = s.event_id AND d.key = ? WHERE s.key = ?`
		)
		.all(to, from) as { event_id: number; source: string; dest: string }[];
	for (const r of both) {
		const joined = r.dest === r.source ? r.dest : `${r.dest} / ${r.source}`;
		db.prepare('UPDATE event_attrs SET value = ? WHERE event_id = ? AND key = ?').run(
			joined,
			r.event_id,
			to
		);
		db.prepare('DELETE FROM event_attrs WHERE event_id = ? AND key = ?').run(r.event_id, from);
	}
	const a = db.prepare('UPDATE event_attrs SET key = ? WHERE key = ?').run(to, from);
	const b = db.prepare('UPDATE object_attrs SET key = ? WHERE key = ?').run(to, from);
	updateTemplates(db, (f) => (f.key === from ? { ...f, key: to } : f));
	const order = getPropertyOrder(db);
	if (order.includes(from))
		setPropertyOrder(
			db,
			order.map((k) => (k === from ? to : k))
		);
	// The kind goes along, unless the name merged into already has one.
	db.prepare('UPDATE OR IGNORE field_kinds SET key = ? WHERE key = ?').run(to, from);
	db.prepare('DELETE FROM field_kinds WHERE key = ?').run(from);
	return both.length + Number(a.changes) + Number(b.changes);
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

function updateTemplates(db: Db, map: (f: FieldTemplate) => FieldTemplate) {
	const rows = db.prepare('SELECT id, fields FROM event_types').all() as {
		id: number;
		fields: string;
	}[];
	for (const r of rows) {
		const fields = (JSON.parse(r.fields) as FieldTemplate[]).map(map);
		const unique = fields.filter(
			(f, i) => fields.findIndex((g) => g.key === f.key && g.target === f.target) === i
		);
		const json = JSON.stringify(unique);
		if (json !== r.fields)
			db.prepare('UPDATE event_types SET fields = ? WHERE id = ?').run(json, r.id);
	}
}
