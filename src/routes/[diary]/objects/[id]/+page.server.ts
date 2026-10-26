import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { deleteEvent, listEvents } from '#lib/server/events.ts';
import { objectStats } from '#lib/server/overview.ts';
import { FILE_ID, getFile } from '#lib/server/files.ts';
import { fileKind } from '#lib/files.ts';
import {
	attrHistory,
	forgetInitialValue,
	getObject,
	setCover,
	setInitialValue
} from '#lib/server/objects.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { getFieldKinds } from '#lib/server/fieldKinds.ts';
import { kindOf, storedValue } from '#lib/fieldKinds.ts';
import { getOverviewColumns } from '#lib/server/settings.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

function objectOr404(id: string) {
	const object = getObject(db(), Number(id));
	if (!object) error(404, t.errors.notFound);
	return object;
}

export const load: PageServerLoad = ({ params }) => {
	const d = db();
	const object = objectOr404(params.id);
	const columns = getOverviewColumns(d);
	const stats = objectStats(d, columns).get(object.id);
	return {
		object,
		history: attrHistory(d, object.id),
		events: listEvents(d, { objectId: object.id, limit: 5000 }),
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
		const file = FILE_ID.test(photo) ? getFile(db(), photo) : undefined;
		// Only photos can be the cover.
		if (!file || fileKind(file.mime, file.original_name) !== 'image') return fail(400);
		setCover(db(), objectOr404(params.id).id, photo);
	},
	forgetInitial: async ({ request, params }) => {
		const key = String((await request.formData()).get('key') ?? '');
		if (!key) return fail(400);
		forgetInitialValue(db(), objectOr404(params.id).id, key);
	},
	setInitial: async ({ request, params }) => {
		const form = await request.formData();
		const key = String(form.get('key') ?? '');
		const d = db();
		const value = storedValue(
			String(form.get('value') ?? '').trim(),
			kindOf(getFieldKinds(d), key)
		);
		if (!key || !value) return fail(400);
		setInitialValue(d, objectOr404(params.id).id, key, value);
	}
};
