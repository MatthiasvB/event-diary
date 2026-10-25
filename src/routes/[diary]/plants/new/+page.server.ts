import { fail, redirect } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/diary.ts';
import { createEvents } from '#lib/server/events.ts';
import { photoType } from '#lib/server/eventTypes.ts';
import { savePhoto } from '#lib/server/photos.ts';
import { parsePlantForm } from '#lib/server/plantForm.ts';
import { createPlant, getPlant, nextPlantId } from '#lib/server/plants.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { isValidDate, today } from '#lib/format.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const d = db();
	const vocab = vocabulary(d);
	// Offer the attributes other plants have, most common first.
	const keys = [...vocab.keys.plant].sort((a, b) => b.count - a.count).slice(0, 8);
	// "Save & next" carries over the acquisition date of the plant just created.
	const acquiredOn = url.searchParams.get('acquiredOn') ?? '';
	const created = getPlant(d, url.searchParams.get('created') ?? '');
	return {
		plant: {
			id: nextPlantId(d, config.plantIdPrefix),
			name: '',
			active: true,
			acquiredOn: isValidDate(acquiredOn) ? acquiredOn : null,
			notes: ''
		},
		attrs: keys.map((k) => ({ key: k.value, value: '' })),
		vocab: { keys: vocab.keys, values: vocab.values },
		created: created && { id: created.id, name: created.name }
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const d = db();
		const form = await request.formData();
		const { input, error } = parsePlantForm(form);
		if (error) return fail(400, { error });
		if (getPlant(d, input.id)) return fail(400, { error: t.plants.idTaken });
		createPlant(d, input);

		// First photos become a photo event; the newest photo is the default cover.
		const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
		if (files.length) {
			const photoIds = [];
			for (const f of files) photoIds.push(await savePhoto(d, f));
			const type = photoType(d);
			const photoDate = String(form.get('photoDate') ?? '');
			createEvents(d, [input.id], {
				typeId: type.id,
				date: isValidDate(photoDate) ? photoDate : today(),
				note: '',
				fields: [],
				photoIds
			});
		}

		if (form.get('next')) {
			const q = new URLSearchParams({ created: input.id, acquiredOn: input.acquiredOn ?? '' });
			redirect(303, `/${params.diary}/plants/new?${q}`);
		}
		redirect(303, `/${params.diary}/plants/${encodeURIComponent(input.id)}`);
	}
};
