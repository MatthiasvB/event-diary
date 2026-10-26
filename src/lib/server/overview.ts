import type { Db } from './db.ts';
import type { OverviewColumn } from './settings.ts';

export type ObjectStats = {
	count: number;
	last: { date: string; type: string } | null;
	/** Last date per overview column, same order as the columns. */
	columns: (string | null)[];
};

/** Event counts and "last …" dates per object, derived from the events. */
export function objectStats(db: Db, columns: OverviewColumn[]): Map<number, ObjectStats> {
	const rows = db
		.prepare(
			`SELECT e.object_id, e.type_id, t.name, count(*) AS n, max(e.date) AS last
			FROM events e JOIN event_types t ON t.id = e.type_id GROUP BY e.object_id, e.type_id`
		)
		.all() as { object_id: number; type_id: number; name: string; n: number; last: string }[];

	const stats = new Map<number, ObjectStats>();
	for (const r of rows) {
		let s = stats.get(r.object_id);
		if (!s) {
			s = { count: 0, last: null, columns: columns.map(() => null) };
			stats.set(r.object_id, s);
		}
		s.count += r.n;
		columns.forEach((c, i) => {
			if (c.typeIds.includes(r.type_id) && (!s.columns[i] || r.last > s.columns[i]!))
				s.columns[i] = r.last;
		});
	}

	// The last event in the same order as the timeline: by date, then the one entered last.
	const last = db
		.prepare(
			`SELECT e.object_id, e.date, t.name FROM events e JOIN event_types t ON t.id = e.type_id
			WHERE e.id = (SELECT l.id FROM events l WHERE l.object_id = e.object_id
				ORDER BY l.date DESC, l.id DESC LIMIT 1)`
		)
		.all() as { object_id: number; date: string; name: string }[];
	for (const r of last) {
		const s = stats.get(r.object_id);
		if (s) s.last = { date: r.date, type: r.name };
	}
	return stats;
}
