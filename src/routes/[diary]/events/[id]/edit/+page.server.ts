import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { parseEventForm, saveEditedEvent, validate } from '#lib/server/eventForm.ts';
import { deleteEvent, getEvent, lastFieldsByType } from '#lib/server/events.ts';
import { objectOptions } from '#lib/server/objectOptions.ts';
import { allHistories } from '#lib/server/objects.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { t } from '#lib/i18n.ts';
import { fieldsFor } from '#lib/domain/eventFields.ts';
import type { DiaryEvent } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

function eventOr404(id: string) {
	const event = getEvent(db(), Number(id));
	if (!event) error(404, t.errors.notFound);
	return event;
}

/** The object whose part of a shared event is edited, as its timeline links here. */
function partOf(event: DiaryEvent, object: unknown): number | null {
	const id = Number(object);
	return event.objects.length > 1 && event.objects.some((o) => o.id === id) ? id : null;
}

export const load: PageServerLoad = ({ params, url }) => {
	const d = db();
	const event = eventOr404(params.id);
	const part = partOf(event, url.searchParams.get('object'));
	return {
		event,
		part,
		objects: objectOptions(d),
		vocab: vocabulary(d),
		lastFields: lastFieldsByType(d),
		histories: allHistories(d),
		initial: {
			objectIds: part === null ? event.objects.map((o) => o.id) : [part],
			typeName: event.typeName,
			category: event.category,
			date: event.date,
			note: event.note,
			fields: fieldsFor(event, part),
			files: event.files
		}
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const d = db();
		const event = eventOr404(params.id);
		const payload = parseEventForm(await request.formData(), d);
		const message = validate(d, payload);
		if (message) return fail(400, { error: message });

		saveEditedEvent(d, event.id, payload);
		redirect(303, `/${params.diary}/objects/${payload.objectIds[0]}`);
	},
	delete: async ({ request, params }) => {
		const d = db();
		const event = eventOr404(params.id);
		const part = partOf(event, (await request.formData()).get('object'));
		deleteEvent(d, event.id, part);
		redirect(303, `/${params.diary}/objects/${part ?? event.objects[0].id}`);
	}
};
