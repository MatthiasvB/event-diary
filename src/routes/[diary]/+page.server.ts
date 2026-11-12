import { db } from '#lib/server/diary.ts';
import { getOverviewColumns, objectStats } from '#lib/server/overview.ts';
import { listObjects } from '#lib/server/objects.ts';
import { allHoldings } from '#lib/server/units.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const d = db();
	const columns = getOverviewColumns(d);
	const stats = objectStats(d, columns);
	const empty = { count: 0, last: null, columns: columns.map(() => null) };
	const held = allHoldings(d);
	const total = (id: number) => [...(held.get(id)?.values() ?? [])].reduce((n, c) => n + c, 0);
	return {
		columns: columns.map((c) => c.label),
		objects: listObjects(d)
			.filter((p) => p.listed)
			.map((p) => ({
				...p,
				stats: stats.get(p.id) ?? empty,
				stockCount: p.stock ? total(p.id) : null
			}))
	};
};
