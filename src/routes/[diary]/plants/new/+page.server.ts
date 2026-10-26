import { fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { createEvents } from '#lib/server/events.ts';
import { photoType } from '#lib/server/eventTypes.ts';
import { FILE_ID, filesExist } from '#lib/server/files.ts';
import { parsePlantForm } from '#lib/server/plantForm.ts';
import { createPlant, currentAttrs, getPlant, nextPlantId } from '#lib/server/plants.ts';
import { getFieldKinds } from '#lib/server/fieldKinds.ts';
import { kindOf } from '#lib/fieldKinds.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { isValidDate, today } from '#lib/format.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const d = db();
	const vocab = vocabulary(d);
	// Offer the attributes other plants have, most common first.
	const keys = [...vocab.keys.plant].sort((a, b) => b.count - a.count).slice(0, 8);
	// "Save & next" carries over the dates (e.g. "Erworben am") of the object just created.
	const created = getPlant(d, url.searchParams.get('created') ?? '');
	const kinds = getFieldKinds(d);
	const carried = Object.entries(created ? (currentAttrs(d).get(created.id) ?? {}) : {}).filter(
		([key]) => kindOf(kinds, key).kind === 'date'
	);
	const attrs = new Map(keys.map((k) => [k.value, '']));
	for (const [key, value] of carried) attrs.set(key, value);
	return {
		plant: {
			// Not shown; changes after each save, which resets the form for the next plant.
			id: nextPlantId(d),
			name: '',
			active: true,
			notes: ''
		},
		attrs: [...attrs].map(([key, value]) => ({ key, value })),
		vocab: { keys: vocab.keys, values: vocab.values },
		created: created && { id: created.id, name: created.name }
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const d = db();
		const form = await request.formData();
		const { input: fields, error } = parsePlantForm(form, d);
		if (error) return fail(400, { error });
		// First photos (uploaded beforehand) become a photo event and the cover.
		const fileIds = form
			.getAll('file')
			.map(String)
			.filter((id) => FILE_ID.test(id));
		if (!filesExist(d, fileIds)) return fail(400, { error: t.files.missing });
		const input = { ...fields, id: nextPlantId(d) };
		createPlant(d, input);

		if (fileIds.length) {
			const type = photoType(d);
			const photoDate = String(form.get('photoDate') ?? '');
			createEvents(d, [input.id], {
				typeId: type.id,
				date: isValidDate(photoDate) ? photoDate : today(),
				note: '',
				fields: [],
				fileIds
			});
		}

		if (form.get('next')) {
			const q = new URLSearchParams({ created: input.id });
			redirect(303, `/${params.diary}/plants/new?${q}`);
		}
		redirect(303, `/${params.diary}/plants/${encodeURIComponent(input.id)}`);
	}
};
