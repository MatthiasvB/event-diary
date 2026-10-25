import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { parsePlantForm } from '#lib/server/plantForm.ts';
import { currentAttrs, deletePlant, getPlant, updatePlant } from '#lib/server/plants.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { today } from '#lib/format.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const d = db();
	const plant = getPlant(d, params.id);
	if (!plant) error(404, t.errors.notFound);
	const attrs = currentAttrs(d).get(plant.id) ?? {};
	const vocab = vocabulary(d);
	return {
		plant,
		attrs: Object.entries(attrs).map(([key, value]) => ({ key, value })),
		vocab: { keys: vocab.keys, values: vocab.values }
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const d = db();
		if (!getPlant(d, params.id)) error(404, t.errors.notFound);
		const { input, error: message } = parsePlantForm(await request.formData());
		if (message) return fail(400, { error: message });
		updatePlant(d, { ...input, id: params.id }, today());
		redirect(303, `/${params.diary}/plants/${encodeURIComponent(params.id)}`);
	},
	delete: ({ params }) => {
		if (!deletePlant(db(), params.id)) return fail(400, { error: t.plants.deleteOnlyEmpty });
		redirect(303, `/${params.diary}`);
	}
};
