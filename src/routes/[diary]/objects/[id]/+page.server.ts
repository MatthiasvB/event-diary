import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { deleteEvent, listEvents } from '#lib/server/events.ts';
import { getOverviewColumns, objectStats } from '#lib/server/overview.ts';
import { FILE_ID, getFile } from '#lib/server/files.ts';
import { fileKind } from '#lib/files.ts';
import {
	attrHistory,
	currentAttrs,
	forgetInitialValue,
	getObject,
	listObjects,
	setCover
} from '#lib/server/objects.ts';
import { associateWith, saveInitialValue } from '#lib/server/objectForm.ts';
import { vocabulary } from '#lib/server/vocab.ts';
import { associationKeys, sortProperties } from '#lib/server/fields.ts';
import { pathOf, pointingTo } from '#lib/domain/associations.ts';
import { stockOptions, unitsHeldBy } from '#lib/server/objectOptions.ts';
import { movesOf } from '#lib/server/units.ts';
import { removeMove, saveMove } from '#lib/server/unitForm.ts';
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
	const columns = getOverviewColumns(d);
	const stats = objectStats(d, columns).get(object.id);
	const history = attrHistory(d, object.id);
	const associations = associationKeys(d);
	const current = currentAttrs(d);
	const stocks = stockOptions(d);
	const units = object.stock
		? {
				kind: 'stock' as const,
				places: (stocks.find((s) => s.id === object.id)?.places ?? []).map(({ place, count }) => ({
					place,
					count,
					paths:
						place === null
							? []
							: associations.map((key) => pathOf(place, key, current)).filter((p) => p.length)
				})),
				moves: movesOf(d, object.id)
			}
		: { kind: 'item' as const, held: unitsHeldBy(d, object.id) };
	return {
		object,
		history,
		associations,
		stocks,
		units,
		paths: Object.fromEntries(associations.map((key) => [key, pathOf(object.id, key, current)])),
		associated: pointingTo(object.id, associations, current),
		items: listObjects(d).filter((o) => o.id !== object.id && !o.stock),
		attrKeys: sortProperties(d, Object.keys(history)),
		events: listEvents(d, { objectId: object.id, limit: 5000 }),
		lastDates: columns.map((c, i) => ({ label: c.label, date: stats?.columns[i] ?? null })),
		values: vocabulary(d).values
	};
};

export const actions: Actions = {
	deleteEvent: async ({ request, params }) => {
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400);
		const refused = deleteEvent(db(), id, objectOr404(params.id).id);
		if (refused) return fail(400, refused);
	},
	cover: async ({ request, params }) => {
		const photo = String((await request.formData()).get('photo') ?? '');
		const file = FILE_ID.test(photo) ? getFile(db(), photo) : undefined;
		if (!file || fileKind(file.mime, file.original_name) !== 'image') return fail(400);
		setCover(db(), objectOr404(params.id).id, photo);
	},
	forgetInitial: async ({ request, params }) => {
		const key = String((await request.formData()).get('key') ?? '');
		if (!key) return fail(400);
		forgetInitialValue(db(), objectOr404(params.id).id, key);
	},
	associate: async ({ request, params }) => {
		const form = await request.formData();
		const key = String(form.get('key') ?? '');
		const ids = form.getAll('object').map(Number).filter(Number.isInteger);
		const refused = associateWith(db(), objectOr404(params.id).id, key, ids, today());
		if (refused) return fail(400, refused);
	},
	moveUnits: async ({ request, params }) => {
		objectOr404(params.id);
		const refused = saveMove(await request.formData(), db());
		if (refused) return fail(400, refused);
	},
	deleteMove: async ({ request, params }) => {
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400);
		const refused = removeMove(db(), objectOr404(params.id).id, id);
		if (refused) return fail(400, refused);
	},
	setInitial: async ({ request, params }) => {
		const form = await request.formData();
		const key = String(form.get('key') ?? '');
		const value = String(form.get('value') ?? '').trim();
		if (!key || !value) return fail(400);
		const refused = saveInitialValue(db(), objectOr404(params.id).id, key, value);
		if (refused) return fail(400, refused);
	}
};
