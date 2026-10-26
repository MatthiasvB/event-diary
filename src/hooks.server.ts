import { error, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { auth } from '#lib/server/auth/index.ts';
import { SESSION_COOKIE, sessionUser } from '#lib/server/auth/sessions.ts';
import { LOCAL_USER, memberDiary, registry } from '#lib/server/registry.ts';
import { t } from '#lib/i18n.ts';

const PUBLIC_PATHS = new Set(['/login', '/manifest.webmanifest']);
const READ_METHODS = new Set(['GET', 'HEAD']);

export const handle: Handle = async ({ event, resolve }) => {
	if (!auth().requiresLogin) {
		// Without login there is one implicit user.
		event.locals.user = LOCAL_USER;
		return resolve(event);
	}

	event.locals.user = sessionUser(event.cookies.get(SESSION_COOKIE));
	const path = event.url.pathname;
	if (!event.locals.user && !PUBLIC_PATHS.has(path)) {
		const next = path + event.url.search;
		redirect(303, next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
	}
	// Viewers may read a diary but not change it. Every change is a POST inside the
	// diary, so this one check covers all of them.
	const diary = event.params.diary;
	if (diary && event.locals.user && !READ_METHODS.has(event.request.method)) {
		if (memberDiary(registry(), diary, event.locals.user)?.role === 'viewer') {
			error(403, t.errors.forbidden);
		}
	}
	return resolve(event);
};
