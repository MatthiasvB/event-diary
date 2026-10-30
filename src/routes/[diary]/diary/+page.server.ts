import { fail, redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth/index.ts';
import {
	currentDiary,
	deleteCurrentDiary,
	diaryContents,
	requireOwner
} from '#lib/server/diary.ts';
import {
	createInvite,
	members,
	openInvites,
	registry,
	removeMember,
	renameDiary,
	revokeInvite,
	setRole,
	SHARED_ROLES,
	type SharedRole
} from '#lib/server/registry.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

const sharedRole = (v: FormDataEntryValue | null) =>
	SHARED_ROLES.find((r) => r === v) as SharedRole | undefined;

export const load: PageServerLoad = () => {
	const diary = currentDiary();
	const owner = diary.role === 'owner';
	const sharing = auth().requiresLogin;
	return {
		members: sharing ? members(registry(), diary.id) : [],
		invites: sharing && owner ? openInvites(registry(), diary.id) : [],
		contents: owner ? diaryContents() : null,
		sharing
	};
};

export const actions: Actions = {
	rename: async ({ request }) => {
		const { id } = requireOwner();
		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { error: t.diaries.nameRequired });
		renameDiary(registry(), id, name);
		return { message: t.settings.saved };
	},
	invite: async ({ request, locals }) => {
		const { id } = requireOwner();
		const role = sharedRole((await request.formData()).get('role'));
		if (!role || !auth().requiresLogin) return fail(400);
		const token = createInvite(registry(), id, role, locals.user!);
		return { invite: { path: `/invite/${token}`, role } };
	},
	revoke: async ({ request }) => {
		const { id } = requireOwner();
		revokeInvite(registry(), id, String((await request.formData()).get('invite') ?? ''));
	},
	setRole: async ({ request }) => {
		const { id } = requireOwner();
		const form = await request.formData();
		const role = sharedRole(form.get('role'));
		if (!role) return fail(400);
		setRole(registry(), id, String(form.get('username') ?? ''), role);
	},
	remove: async ({ request }) => {
		const { id } = requireOwner();
		removeMember(registry(), id, String((await request.formData()).get('username') ?? ''));
	},
	delete: () => {
		deleteCurrentDiary();
		redirect(303, '/?choose=1');
	}
};
