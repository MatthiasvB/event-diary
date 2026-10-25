import { fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { parseEventForm, saveNewEvents, validate } from '#lib/server/eventForm.ts';
import { batchPlantIds, getEvent, lastFieldsByType } from '#lib/server/events.ts';
import { photoType } from '#lib/server/eventTypes.ts';
import { plantOptions } from '#lib/server/plantOptions.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { today } from '#lib/format.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const d = db();
	const plants = plantOptions(d);
	const known = new Set(plants.map((p) => p.id));
	const photoMode = url.searchParams.has('photo');

	let initial = {
		plantIds: url.searchParams.getAll('plant').filter((id) => known.has(id)),
		typeName: photoMode ? photoType(d).name : '',
		date: today(),
		note: '',
		fields: [] as { key: string; value: string; target: 'event' | 'plant' }[],
		keptPhotos: [] as string[]
	};

	// Repeat: copy an event (for all plants of its batch) with today's date.
	const from = getEvent(d, Number(url.searchParams.get('from')));
	if (from) {
		const plantIds = from.batchId ? batchPlantIds(d, from.batchId) : [from.plantId];
		initial = {
			...initial,
			plantIds,
			typeName: from.typeName,
			note: from.note,
			fields: from.fields
		};
	}

	return { plants, vocab: vocabulary(d), lastFields: lastFieldsByType(d), initial, photoMode };
};

export const actions: Actions = {
	save: async ({ request }) => {
		const d = db();
		const { payload, files } = parseEventForm(await request.formData());
		const error = validate(d, payload);
		if (error) return fail(400, { error });

		const ids = await saveNewEvents(d, payload, files);
		if (payload.plantIds.length === 1)
			redirect(303, `/plants/${encodeURIComponent(payload.plantIds[0])}`);
		redirect(303, `/events?saved=${ids.length}`);
	}
};
