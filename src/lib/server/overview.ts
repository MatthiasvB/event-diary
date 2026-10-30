import { transaction, type Db } from './db.ts';

export type OverviewColumn = { label: string; typeIds: number[] };

export function getOverviewColumns(db: Db): OverviewColumn[] {
	const rows = db
		.prepare(
			`SELECT c.id, c.label, ct.type_id FROM overview_columns c
			LEFT JOIN overview_column_types ct ON ct.column_id = c.id
			ORDER BY c.position, c.id, ct.rowid`
		)
		.all() as { id: number; label: string; type_id: number | null }[];
	const columns = new Map<number, OverviewColumn>();
	for (const r of rows) {
		const column = columns.get(r.id) ?? { label: r.label, typeIds: [] };
		if (r.type_id !== null) column.typeIds.push(r.type_id);
		columns.set(r.id, column);
	}
	return [...columns.values()];
}

/** Types that don't exist are left out. */
export function setOverviewColumns(db: Db, columns: OverviewColumn[]) {
	transaction(db, () => {
		db.prepare('DELETE FROM overview_columns').run();
		const column = db.prepare(
			'INSERT INTO overview_columns (label, position) VALUES (?, ?) RETURNING id'
		);
		const type = db.prepare(
			`INSERT OR IGNORE INTO overview_column_types (column_id, type_id)
			SELECT ?, id FROM event_types WHERE id = ?`
		);
		columns.forEach((c, i) => {
			const { id } = column.get(c.label, i) as { id: number };
			for (const typeId of c.typeIds) type.run(id, typeId);
		});
	});
}

export type ObjectStats = {
	count: number;
	last: { date: string; type: string } | null;
	/** Same order as the columns. */
	columns: (string | null)[];
};

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

	// Same order as the timeline.
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
