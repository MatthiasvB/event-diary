import { fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { createEvents } from '#lib/server/events.ts';
import { photoType } from '#lib/server/eventTypes.ts';
import { FILE_ID, filesExist } from '#lib/server/files.ts';
import { parseObjectForm } from '#lib/server/objectForm.ts';
import { createObject, currentAttrs, getObject } from '#lib/server/objects.ts';
import { getFieldKinds } from '#lib/server/fieldKinds.ts';
import { kindOf } from '#lib/fieldKinds.ts';
import { sortProperties } from '#lib/server/settings.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { isValidDate, today } from '#lib/format.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const d = db();
	const vocab = vocabulary(d);
	const keys = [...vocab.keys.object].sort((a, b) => b.count - a.count).slice(0, 8);
	// "Save & next" carries over the dates (e.g. "Erworben am") of the object just created.
	const created = getObject(d, Number(url.searchParams.get('created')));
	const kinds = getFieldKinds(d);
	const carried = Object.entries(created ? (currentAttrs(d).get(created.id) ?? {}) : {}).filter(
		([key]) => kindOf(kinds, key).kind === 'date'
	);
	const attrs = new Map(
		sortProperties(
			d,
			keys.map((k) => k.value)
		).map((key) => [key, ''])
	);
	for (const [key, value] of carried) attrs.set(key, value);
	return {
		object: {
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
		const { input: fields, error } = parseObjectForm(form, d);
		if (error) return fail(400, { error });
		const fileIds = form
			.getAll('file')
			.map(String)
			.filter((id) => FILE_ID.test(id));
		if (!filesExist(d, fileIds)) return fail(400, { error: t.files.missing });
		const id = createObject(d, fields);

		if (fileIds.length) {
			const type = photoType(d);
			const photoDate = String(form.get('photoDate') ?? '');
			createEvents(d, [id], {
				typeId: type.id,
				date: isValidDate(photoDate) ? photoDate : today(),
				note: '',
				fields: [],
				fileIds
			});
		}

		if (form.get('next')) {
			redirect(303, `/${params.diary}/objects/new?created=${id}`);
		}
		redirect(303, `/${params.diary}/objects/${id}`);
	}
};
