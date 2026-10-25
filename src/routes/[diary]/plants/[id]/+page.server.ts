import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { deleteEvent, listEvents } from '#lib/server/events.ts';
import { plantStats } from '#lib/server/overview.ts';
import { PHOTO_ID } from '#lib/server/photos.ts';
import {
	attrHistory,
	forgetInitialValue,
	getPlant,
	setCover,
	setInitialValue
} from '#lib/server/plants.ts';
import { vocabulary } from '#lib/server/vocab.ts';
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
		lastDates: columns.map((c, i) => ({ label: c.label, date: stats?.columns[i] ?? null })),
		values: vocabulary(d).values
	};
};

export const actions: Actions = {
	deleteEvent: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400);
		deleteEvent(db(), id);
	},
	cover: async ({ request, params }) => {
		const photo = String((await request.formData()).get('photo') ?? '');
		if (!PHOTO_ID.test(photo)) return fail(400);
		setCover(db(), params.id, photo);
	},
	forgetInitial: async ({ request, params }) => {
		const key = String((await request.formData()).get('key') ?? '');
		if (!key) return fail(400);
		forgetInitialValue(db(), params.id, key);
	},
	setInitial: async ({ request, params }) => {
		const form = await request.formData();
		const key = String(form.get('key') ?? '');
		const value = String(form.get('value') ?? '').trim();
		if (!key || !value) return fail(400);
		setInitialValue(db(), params.id, key, value);
	}
};
