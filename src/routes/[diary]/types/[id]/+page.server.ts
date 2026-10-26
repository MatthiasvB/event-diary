import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { deleteType, typeImpact } from '#lib/server/events.ts';
import { getType, listTypes, updateType } from '#lib/server/eventTypes.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { t } from '#lib/i18n.ts';
import type { FieldTemplate } from '#lib/types.ts';
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
		const form = await request.formData();
		const keys = form.getAll('fieldKey').map((v) => String(v).trim());
		const values = form.getAll('fieldValue').map((v) => String(v).trim());
		const targets = form.getAll('fieldTarget').map(String);
		const fields: FieldTemplate[] = keys
			.map((key, i) => ({
				key,
				target: targets[i] === 'plant' ? ('plant' as const) : ('event' as const),
				...(values[i] ? { default: values[i] } : {})
			}))
			.filter((f) => f.key);
		const category = String(form.get('category') ?? '').trim();
		const saved = updateType(d, {
			id: type.id,
			category,
			milestone: form.get('milestone') === 'on',
			hint: String(form.get('hint') ?? '').trim(),
			fields
		});
		if (!saved) return fail(400, { error: t.types.categoryTaken(type.name, category) });
		redirect(303, `/${params.diary}/types`);
	},
	delete: ({ params }) => {
		const d = db();
		if (!getType(d, Number(params.id))) error(404, t.errors.notFound);
		deleteType(d, Number(params.id));
		redirect(303, `/${params.diary}/types`);
	}
};
