import { db } from '#lib/server/db.ts';
import { plantStats } from '#lib/server/overview.ts';
import { listPlants } from '#lib/server/plants.ts';
import { getOverviewColumns } from '#lib/server/settings.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const d = db();
	const columns = getOverviewColumns(d);
	const stats = plantStats(d, columns);
	const empty = { count: 0, last: null, columns: columns.map(() => null) };
	return {
		columns: columns.map((c) => c.label),
		plants: listPlants(d).map((p) => ({ ...p, stats: stats.get(p.id) ?? empty }))
	};
};
