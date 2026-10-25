import { fail, redirect } from '@sveltejs/kit';
import { isAllowed } from '#lib/server/auth/index.ts';
import { USERNAME } from '#lib/server/auth/pam.ts';
import { config } from '#lib/server/config.ts';
import { claimLegacyDiary, needsOwner } from '#lib/server/diary.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

// Data from before there were diaries and users: the first user to log in decides,
// once, who owns it. It becomes a plant diary of that user.

export const load: PageServerLoad = () => {
	if (!needsOwner()) redirect(303, '/');
	return { diaryName: config.appName };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const owner =
			form.get('owner') === 'me' ? locals.user! : String(form.get('other') ?? '').trim();
		if (!USERNAME.test(owner)) return fail(400, { error: t.claim.invalidUser });
		if (!isAllowed(owner)) return fail(400, { error: t.claim.notAllowed });
		// Someone else may have answered in the meantime.
		if (!needsOwner()) redirect(303, '/');

		const id = claimLegacyDiary(owner);
		redirect(303, owner === locals.user ? `/${id}` : '/');
	}
};
