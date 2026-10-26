import { db } from '#lib/server/diary.ts';
import { listTypes } from '#lib/server/eventTypes.ts';
import {
	getOverviewColumns,
	setOverviewColumns,
	setPropertyOrder,
	sortProperties
} from '#lib/server/settings.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const d = db();
	return {
		columns: getOverviewColumns(d),
		types: listTypes(d).map((ty) => ({ id: ty.id, name: ty.name, category: ty.category })),
		properties: sortProperties(
			d,
			vocabulary(d).keys.object.map((k) => k.value)
		)
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
		return { saved: 'columns', message: t.settings.saved };
	},
	propertyOrder: async ({ request }) => {
		const keys = JSON.parse(String((await request.formData()).get('keys') ?? '[]')) as unknown;
		setPropertyOrder(
			db(),
			(Array.isArray(keys) ? keys : []).map((k) => String(k).trim())
		);
		return { saved: 'properties', message: t.settings.saved };
	}
};
