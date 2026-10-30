import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { deleteType, typeImpact } from '#lib/server/events.ts';
import { getType, listTypes, updateType } from '#lib/server/eventTypes.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { parseTypeForm } from '#lib/server/typeForm.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const d = db();
	const type = listTypes(d).find((ty) => ty.id === Number(params.id));
	if (!type) error(404, t.errors.notFound);
	const vocab = vocabulary(d);
	return {
		type,
		impact: typeImpact(d, type.id),
		vocab: { keys: vocab.keys, values: vocab.values, categories: vocab.categories }
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const d = db();
		const type = getType(d, Number(params.id));
		if (!type) error(404, t.errors.notFound);
		const input = parseTypeForm(await request.formData(), d);
		const saved = updateType(d, { id: type.id, ...input });
		if (!saved) return fail(400, { error: t.types.categoryTaken(type.name, input.category) });
		redirect(303, `/${params.diary}/types`);
	},
	delete: ({ params }) => {
		const d = db();
		if (!getType(d, Number(params.id))) error(404, t.errors.notFound);
		deleteType(d, Number(params.id));
		redirect(303, `/${params.diary}/types`);
	}
};
