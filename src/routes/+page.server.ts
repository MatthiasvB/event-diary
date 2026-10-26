import { fail, redirect } from '@sveltejs/kit';
import {
	createDiary,
	DIARY_TYPES,
	memberDiary,
	registry,
	removeMember,
	userDiaries,
	type DiaryType
} from '#lib/server/registry.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

/** Where to continue inside the chosen diary, e.g. "events/new?photo=1" (shared photos). */
function continueWith(then: string | null): string {
	return then && /^[a-z][\w\-/?=&%.]*$/i.test(then) && !then.includes('//') ? then : '';
}

export const load: PageServerLoad = ({ locals, url }) => {
	const diaries = userDiaries(registry(), locals.user!);
	const then = continueWith(url.searchParams.get('then'));
	// With a single diary there is nothing to choose.
	if (diaries.length === 1 && !url.searchParams.has('choose')) {
		redirect(303, `/${diaries[0].id}${then ? `/${then}` : ''}`);
	}
	return { diaries, then, types: DIARY_TYPES };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const type = String(form.get('type') ?? '') as DiaryType;
		if (!name) return fail(400, { error: t.diaries.nameRequired });
		if (!DIARY_TYPES.includes(type)) return fail(400);
		const id = createDiary(registry(), name, type, locals.user!);
		redirect(303, `/${id}`);
	},
	// Here rather than in the diary, so that viewers (who can't post there) can leave.
	leave: async ({ request, locals }) => {
		const id = String((await request.formData()).get('diary') ?? '');
		const diary = memberDiary(registry(), id, locals.user!);
		// The owner can't leave; deleting is the way out.
		if (!diary || diary.role === 'owner') return fail(400);
		removeMember(registry(), id, locals.user!);
		redirect(303, '/?choose=1');
	}
};
