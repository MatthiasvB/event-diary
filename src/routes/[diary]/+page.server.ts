import { db } from '#lib/server/diary.ts';
import { objectStats } from '#lib/server/overview.ts';
import { listObjects } from '#lib/server/objects.ts';
import { getOverviewColumns } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const d = db();
	const columns = getOverviewColumns(d);
	const stats = objectStats(d, columns);
	const empty = { count: 0, last: null, columns: columns.map(() => null) };
	return {
		columns: columns.map((c) => c.label),
		objects: listObjects(d).map((p) => ({ ...p, stats: stats.get(p.id) ?? empty }))
	};
};
