// Free-text values with suggestions: collecting them from the data, and renaming or
// merging them everywhere they are used.
import type { Candidate } from '../suggest.ts';
import type { FieldTarget, FieldTemplate, ValueCandidate, Vocabulary } from '../types.ts';
import { transaction, type Db } from './db.ts';
import { listTypes } from './eventTypes.ts';
import { getSetting, setOverviewColumns, type OverviewColumn } from './settings.ts';

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
	const plantRows = db
		.prepare(
			`SELECT a.key, a.value, e.type_id, count(*) AS n, max(coalesce(a.since, p.acquired_on)) AS last
			FROM plant_attrs a JOIN plants p ON p.id = a.plant_id LEFT JOIN events e ON e.id = a.event_id
			GROUP BY a.key, a.value, e.type_id`
		)
		.all() as UsageRow[];

	const values = new Map<string, Map<string, ValueCandidate>>();
	const keys: Record<FieldTarget, Map<string, ValueCandidate>> = {
		event: new Map(),
		plant: new Map()
	};
	for (const [target, rows] of [
		['event', eventRows],
		['plant', plantRows]
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
		.all() as Candidate[];

	return {
		types: listTypes(db),
		categories: categories.map((c) => ({ ...c })),
		keys: { event: [...keys.event.values()], plant: [...keys.plant.values()] },
		values: Object.fromEntries([...values].map(([k, m]) => [k, [...m.values()]]))
	};
}

/** Kinds of values that can be renamed or merged in data maintenance. */
export type ValueKind =
	{ kind: 'category' } | { kind: 'type' } | { kind: 'key' } | { kind: 'value'; key: string };

/** Rename `from` to `to`; if `to` already exists, both are merged. Returns affected records. */
export function rename(db: Db, what: ValueKind, from: string, to: string): number {
	to = to.trim();
	if (!to || from === to) return 0;
	return transaction(db, () => {
		switch (what.kind) {
			case 'category':
				return Number(
					db.prepare('UPDATE event_types SET category = ? WHERE category = ?').run(to, from).changes
				);
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
	const a = db
		.prepare('UPDATE event_attrs SET value = ? WHERE key = ? AND value = ?')
		.run(to, key, from);
	const b = db
		.prepare('UPDATE plant_attrs SET value = ? WHERE key = ? AND value = ?')
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
	const b = db.prepare('UPDATE plant_attrs SET key = ? WHERE key = ?').run(to, from);
	updateTemplates(db, (f) => (f.key === from ? { ...f, key: to } : f));
	return both.length + Number(a.changes) + Number(b.changes);
}

function renameType(db: Db, from: string, to: string): number {
	const source = db.prepare('SELECT id FROM event_types WHERE name = ?').get(from) as
		{ id: number } | undefined;
	if (!source) return 0;
	const target = db.prepare('SELECT id FROM event_types WHERE name = ?').get(to) as
		{ id: number } | undefined;
	if (!target) {
		return Number(
			db.prepare('UPDATE event_types SET name = ? WHERE id = ?').run(to, source.id).changes
		);
	}
	const moved = db
		.prepare('UPDATE events SET type_id = ? WHERE type_id = ?')
		.run(target.id, source.id);
	db.prepare('DELETE FROM event_types WHERE id = ?').run(source.id);
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
