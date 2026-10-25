import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { deleteType, getType, listTypes, updateType } from '#lib/server/eventTypes.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { t } from '#lib/i18n.ts';
import type { FieldTemplate } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const d = db();
	const type = listTypes(d).find((ty) => ty.id === Number(params.id));
	if (!type) error(404, t.errors.notFound);
	const vocab = vocabulary(d);
	return { type, vocab: { keys: vocab.keys, values: vocab.values, categories: vocab.categories } };
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
		updateType(d, {
			id: type.id,
			category: String(form.get('category') ?? '').trim(),
			milestone: form.get('milestone') === 'on',
			hint: String(form.get('hint') ?? '').trim(),
			fields
		});
		redirect(303, `/${params.diary}/types`);
	},
	delete: ({ params }) => {
		if (!deleteType(db(), Number(params.id))) return fail(400, { error: t.types.deleteUsed });
		redirect(303, `/${params.diary}/types`);
	}
};
