import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { parseObjectForm } from '#lib/server/objectForm.ts';
import { deleteObject, objectImpact } from '#lib/server/events.ts';
import { currentAttrs, getObject, updateObject } from '#lib/server/objects.ts';
import { sortProperties } from '#lib/server/fields.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { today } from '#lib/format.ts';
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
	const attrs = currentAttrs(d).get(object.id) ?? {};
	const vocab = vocabulary(d);
	return {
		object,
		impact: objectImpact(d, object.id),
		attrs: sortProperties(d, Object.keys(attrs)).map((key) => ({ key, value: attrs[key] })),
		vocab: { keys: vocab.keys, values: vocab.values }
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const d = db();
		const { id } = objectOr404(params.id);
		const { input, error: message } = parseObjectForm(await request.formData(), d);
		if (message) return fail(400, { error: message });
		updateObject(d, { ...input, id }, today());
		redirect(303, `/${params.diary}/objects/${id}`);
	},
	delete: ({ params }) => {
		deleteObject(db(), objectOr404(params.id).id);
		redirect(303, `/${params.diary}`);
	}
};
