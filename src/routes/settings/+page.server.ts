import { db } from '#lib/server/db.ts';
import { listTypes } from '#lib/server/eventTypes.ts';
import { getOverviewColumns, setOverviewColumns } from '#lib/server/settings.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const d = db();
	return {
		columns: getOverviewColumns(d),
		types: listTypes(d).map((ty) => ({ id: ty.id, name: ty.name, category: ty.category }))
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const columns = JSON.parse(String((await request.formData()).get('columns') ?? '[]')) as {
			label: unknown;
			typeIds: unknown;
		}[];
		setOverviewColumns(
			db(),
			columns
				.map((c) => ({
					label: String(c.label ?? '').trim(),
					typeIds: (Array.isArray(c.typeIds) ? c.typeIds : []).map(Number).filter(Number.isInteger)
				}))
				.filter((c) => c.label && c.typeIds.length)
		);
		return { message: t.settings.saved };
	}
};
