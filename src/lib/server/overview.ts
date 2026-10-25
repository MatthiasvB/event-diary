import type { Db } from './db.ts';
import type { OverviewColumn } from './settings.ts';

export type PlantStats = {
	count: number;
	last: { date: string; type: string } | null;
	/** Last date per overview column, same order as the columns. */
	columns: (string | null)[];
};

/** Event counts and "last …" dates per plant, derived from the events. */
export function plantStats(db: Db, columns: OverviewColumn[]): Map<string, PlantStats> {
	const rows = db
		.prepare(
			`SELECT e.plant_id, e.type_id, t.name, count(*) AS n, max(e.date) AS last
			FROM events e JOIN event_types t ON t.id = e.type_id GROUP BY e.plant_id, e.type_id`
		)
		.all() as { plant_id: string; type_id: number; name: string; n: number; last: string }[];

	const stats = new Map<string, PlantStats>();
	for (const r of rows) {
		let s = stats.get(r.plant_id);
		if (!s) {
			s = { count: 0, last: null, columns: columns.map(() => null) };
			stats.set(r.plant_id, s);
		}
		s.count += r.n;
		if (!s.last || r.last > s.last.date) s.last = { date: r.last, type: r.name };
		columns.forEach((c, i) => {
			if (c.typeIds.includes(r.type_id) && (!s.columns[i] || r.last > s.columns[i]!))
				s.columns[i] = r.last;
		});
	}
	return stats;
}
