import { fail, redirect } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db.ts';
import { parsePlantForm } from '#lib/server/plantForm.ts';
import { createPlant, getPlant, nextPlantId } from '#lib/server/plants.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const d = db();
	const vocab = vocabulary(d);
	// Offer the attributes other plants have, most common first.
	const keys = [...vocab.keys.plant].sort((a, b) => b.count - a.count).slice(0, 8);
	return {
		plant: {
			id: nextPlantId(d, config.plantIdPrefix),
			name: '',
			active: true,
			acquiredOn: null,
			notes: ''
		},
		attrs: keys.map((k) => ({ key: k.value, value: '' })),
		vocab: { keys: vocab.keys, values: vocab.values }
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const d = db();
		const { input, error } = parsePlantForm(await request.formData());
		if (error) return fail(400, { error });
		if (getPlant(d, input.id)) return fail(400, { error: t.plants.idTaken });
		createPlant(d, input);
		redirect(303, `/plants/${encodeURIComponent(input.id)}`);
	}
};
