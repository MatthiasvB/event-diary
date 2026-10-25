import { fail, redirect } from '@sveltejs/kit';
import {
	auth,
	isAllowed,
	isThrottled,
	recordFailure,
	recordSuccess
} from '#lib/server/auth/index.ts';
import { SESSION_COOKIE, createSession } from '#lib/server/auth/sessions.ts';
import { config } from '#lib/server/config.ts';
import { db } from '#lib/server/db.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

/** Only same-site paths, to avoid open redirects. */
function safeNext(next: string | null) {
	return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user || !auth().requiresLogin) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (isThrottled(username)) return fail(429, { username, error: t.login.throttled });
		const ok = isAllowed(username) && (await auth().checkPassword(username, password));
		if (!ok) {
			recordFailure(username);
			return fail(401, { username, error: t.login.failed });
		}
		recordSuccess(username);

		const { token, expires } = createSession(db(), username, config.auth.sessionDays);
		cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', expires });
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
