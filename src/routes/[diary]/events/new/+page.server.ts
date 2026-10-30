import { fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { parseEventForm, saveNewEvent, validate } from '#lib/server/eventForm.ts';
import { getEvent, lastFieldsByType } from '#lib/server/events.ts';
import { photoType } from '#lib/server/eventTypes.ts';
import { objectOptions } from '#lib/server/objectOptions.ts';
import { allHistories } from '#lib/server/objects.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { today } from '#lib/format.ts';
import type { EventFile } from '#lib/files.ts';
import type { RecordedField } from '#lib/types.ts';
import { fieldsFor } from '#lib/domain/eventFields.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const d = db();
	const objects = objectOptions(d);
	const known = new Set(objects.map((o) => o.id));
	const photoMode = url.searchParams.has('photo');

	const preset = photoMode ? photoType(d) : undefined;
	let initial = {
		objectIds: url.searchParams
			.getAll('object')
			.map(Number)
			.filter((id) => known.has(id)),
		typeName: preset?.name ?? '',
		category: preset?.category ?? (null as string | null),
		date: today(),
		note: '',
		fields: [] as RecordedField[],
		files: [] as EventFile[]
	};

	const from = getEvent(d, Number(url.searchParams.get('from')));
	if (from) {
		initial = {
			...initial,
			objectIds: from.objects.map((o) => o.id),
			typeName: from.typeName,
			category: from.category,
			note: from.note,
			fields: fieldsFor(from, null)
		};
	}

	return {
		objects,
		vocab: vocabulary(d),
		lastFields: lastFieldsByType(d),
		histories: allHistories(d),
		initial,
		photoMode,
		// Images shared from another app wait in the service worker's cache.
		shared: url.searchParams.has('shared')
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const d = db();
		const payload = parseEventForm(await request.formData(), d);
		const error = validate(d, payload);
		if (error) return fail(400, { error });

		saveNewEvent(d, payload);
		if (payload.objectIds.length === 1)
			redirect(303, `/${params.diary}/objects/${payload.objectIds[0]}`);
		redirect(303, `/${params.diary}/events?saved=1`);
	}
};
