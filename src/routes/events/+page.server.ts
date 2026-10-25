import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { deleteEvent, listEvents } from '#lib/server/events.ts';
import { listTypes } from '#lib/server/eventTypes.ts';
import { listPlants } from '#lib/server/plants.ts';
import type { Actions, PageServerLoad } from './$types';

const PAGE = 100;

export const load: PageServerLoad = ({ url }) => {
	const d = db();
	const q = url.searchParams;
	const filter = {
		plantId: q.get('plant') ?? '',
		typeId: q.get('type') ?? '',
		category: q.get('category') ?? '',
		from: q.get('from') ?? '',
		to: q.get('to') ?? ''
	};
	const limit = Math.max(PAGE, Number(q.get('limit')) || PAGE);
	const events = listEvents(d, {
		...filter,
		typeId: filter.typeId ? Number(filter.typeId) : undefined,
		limit: limit + 1
	});
	const types = listTypes(d);
	return {
		filter,
		limit,
		events: events.slice(0, limit),
		hasMore: events.length > limit,
		plants: listPlants(d).map((p) => ({ id: p.id, name: p.name })),
		types: types.map((ty) => ({ id: ty.id, name: ty.name })),
		categories: [...new Set(types.map((ty) => ty.category).filter(Boolean))].sort(),
		saved: Number(q.get('saved')) || 0
	};
};

export const actions: Actions = {
	deleteEvent: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400);
		deleteEvent(db(), id);
	}
};
