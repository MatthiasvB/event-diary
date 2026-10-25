import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { auth } from '#lib/server/auth/index.ts';
import { SESSION_COOKIE, sessionUser } from '#lib/server/auth/sessions.ts';
import { claimLegacyDiary, needsOwner } from '#lib/server/diary.ts';
import { LOCAL_USER } from '#lib/server/registry.ts';

const PUBLIC_PATHS = new Set(['/login', '/manifest.webmanifest']);
// Reachable while data from before there were diaries and users waits for its owner.
const CLAIM_PATHS = new Set(['/claim', '/logout']);

export const handle: Handle = async ({ event, resolve }) => {
	if (!auth().requiresLogin) {
		// Without login there is one implicit user, who owns any existing data.
		event.locals.user = LOCAL_USER;
		if (needsOwner()) claimLegacyDiary(LOCAL_USER);
		return resolve(event);
	}

	event.locals.user = sessionUser(event.cookies.get(SESSION_COOKIE));
	const path = event.url.pathname;
	if (!event.locals.user && !PUBLIC_PATHS.has(path)) {
		const next = path + event.url.search;
		redirect(303, next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
	}
	// Nobody uses the app until the existing data has an owner.
	if (event.locals.user && needsOwner() && !CLAIM_PATHS.has(path)) redirect(303, '/claim');
	return resolve(event);
};
