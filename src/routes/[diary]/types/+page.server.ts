import { error } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { categoryImpact, deleteCategory } from '#lib/server/events.ts';
import { listTypes } from '#lib/server/eventTypes.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const d = db();
	const types = listTypes(d);
	const categories = [...new Set(types.map((ty) => ty.category).filter(Boolean))];
	return {
		types,
		impacts: Object.fromEntries(categories.map((c) => [c, categoryImpact(d, c)]))
	};
};

export const actions: Actions = {
	deleteCategory: async ({ request }) => {
		const category = String((await request.formData()).get('category') ?? '');
		const d = db();
		if (!category || !listTypes(d).some((ty) => ty.category === category)) {
			error(404, t.errors.notFound);
		}
		deleteCategory(d, category);
	}
};
