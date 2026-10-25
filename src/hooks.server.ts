import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { auth } from '#lib/server/auth/index.ts';
import { SESSION_COOKIE, sessionUser } from '#lib/server/auth/sessions.ts';
import { db } from '#lib/server/db.ts';

const PUBLIC_PATHS = new Set(['/login', '/manifest.webmanifest']);

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	if (!auth().requiresLogin) return resolve(event);

	event.locals.user = sessionUser(db(), event.cookies.get(SESSION_COOKIE));
	if (!event.locals.user && !PUBLIC_PATHS.has(event.url.pathname)) {
		const next = event.url.pathname + event.url.search;
		redirect(303, next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
	}
	return resolve(event);
};
