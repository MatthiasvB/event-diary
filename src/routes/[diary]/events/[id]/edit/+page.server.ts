import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { parseEventForm, saveEditedEvent, validate } from '#lib/server/eventForm.ts';
import { deleteEvent, getEvent, lastFieldsByType } from '#lib/server/events.ts';
import { plantOptions } from '#lib/server/plantOptions.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

function eventOr404(id: string) {
	const event = getEvent(db(), Number(id));
	if (!event) error(404, t.errors.notFound);
	return event;
}

export const load: PageServerLoad = ({ params }) => {
	const d = db();
	const event = eventOr404(params.id);
	return {
		event,
		plants: plantOptions(d),
		vocab: vocabulary(d),
		lastFields: lastFieldsByType(d),
		initial: {
			plantIds: [event.plantId],
			typeName: event.typeName,
			category: event.category,
			date: event.date,
			note: event.note,
			fields: event.fields,
			files: event.files
		}
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const d = db();
		const event = eventOr404(params.id);
		const payload = parseEventForm(await request.formData());
		const message = validate(d, payload);
		if (message) return fail(400, { error: message });

		saveEditedEvent(d, event.id, payload);
		redirect(303, `/${params.diary}/plants/${encodeURIComponent(payload.plantIds[0])}`);
	},
	delete: ({ params }) => {
		const d = db();
		const event = eventOr404(params.id);
		deleteEvent(d, event.id);
		redirect(303, `/${params.diary}/plants/${encodeURIComponent(event.plantId)}`);
	}
};
