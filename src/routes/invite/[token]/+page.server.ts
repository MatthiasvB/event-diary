import { fail, redirect } from '@sveltejs/kit';
import { acceptInvite, inviteInfo, memberDiary, registry } from '#lib/server/registry.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

// Only the button's POST uses up the invite, so link previews in messengers can't spend it.
export const load: PageServerLoad = ({ params, locals }) => {
	const invite = inviteInfo(registry(), params.token);
	if (!invite) return { invite: null, member: false };
	const member = !!memberDiary(registry(), invite.diaryId, locals.user!);
	return {
		invite: {
			diaryId: invite.diaryId,
			diaryName: invite.diaryName,
			role: invite.role,
			by: invite.createdBy
		},
		member
	};
};

export const actions: Actions = {
	default: ({ params, locals }) => {
		const id = acceptInvite(registry(), params.token, locals.user!);
		if (!id) return fail(410, { error: t.invite.invalid });
		redirect(303, `/${id}`);
	}
};
