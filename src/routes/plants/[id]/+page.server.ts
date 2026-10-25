import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { listEvents } from '#lib/server/events.ts';
import { plantStats } from '#lib/server/overview.ts';
import { PHOTO_ID } from '#lib/server/photos.ts';
import { attrHistory, getPlant, setCover } from '#lib/server/plants.ts';
import { getOverviewColumns } from '#lib/server/settings.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const d = db();
	const plant = getPlant(d, params.id);
	if (!plant) error(404, t.errors.notFound);
	const columns = getOverviewColumns(d);
	const stats = plantStats(d, columns).get(plant.id);
	return {
		plant,
		history: attrHistory(d, plant.id),
		events: listEvents(d, { plantId: plant.id, limit: 5000 }),
		lastDates: columns.map((c, i) => ({ label: c.label, date: stats?.columns[i] ?? null }))
	};
};

export const actions: Actions = {
	cover: async ({ request, params }) => {
		const photo = String((await request.formData()).get('photo') ?? '');
		if (!PHOTO_ID.test(photo)) return fail(400);
		setCover(db(), params.id, photo);
	}
};
