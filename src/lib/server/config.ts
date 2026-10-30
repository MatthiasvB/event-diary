// Free of SvelteKit imports, so the backup CLI can run this file directly with Node.
import path from 'node:path';

const env = process.env;

const dataDir = path.resolve(env.DATA_DIR ?? './data');

/** Like adapter-node reads BODY_SIZE_LIMIT: "512K", "100M", "1G" or bytes. */
function bytes(value: string): number {
	const unit = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[value.slice(-1).toUpperCase()];
	return unit ? Number(value.slice(0, -1)) * unit : Number(value);
}

export const config = {
	appName: env.APP_NAME || 'Ereignistagebuch',

	dataDir,
	dbDir: path.join(dataDir, 'db'),
	photosDir: path.join(dataDir, 'photos'),
	snapshotDir: path.join(dataDir, 'snapshot'),
	preMigrationDir: path.join(dataDir, 'pre-migration'),
	cacheDir: path.resolve(env.CACHE_DIR ?? path.join(dataDir, 'cache')),

	vipsthumbnail: env.VIPSTHUMBNAIL || 'vipsthumbnail',
	vipsheader: env.VIPSTHUMBNAIL
		? path.join(path.dirname(env.VIPSTHUMBNAIL), 'vipsheader')
		: 'vipsheader',
	maxUploadBytes: bytes(env.BODY_SIZE_LIMIT || '512K'),

	auth: {
		backend: env.AUTH_BACKEND || 'pam',
		pamService: env.PAM_SERVICE || 'event-diary',
		pamHelper: env.PAM_HELPER || 'event-diary-pam-auth',
		/** Empty: every user that PAM accepts may log in. */
		allowedUsers: (env.AUTH_ALLOWED_USERS ?? '').split(/[\s,]+/).filter(Boolean),
		sessionDays: Number(env.SESSION_DAYS || 90)
	}
};
