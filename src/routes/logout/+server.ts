import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, deleteSession } from '#lib/server/auth/sessions.ts';
import { db } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) deleteSession(db(), token);
	cookies.delete(SESSION_COOKIE, {});
	redirect(303, '/login');
};
