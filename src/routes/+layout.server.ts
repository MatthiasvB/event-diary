import { auth } from '#lib/server/auth/index.ts';
import { config } from '#lib/server/config.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	appName: config.appName,
	user: locals.user,
	requiresLogin: auth().requiresLogin,
	maxUploadBytes: config.maxUploadBytes
});
