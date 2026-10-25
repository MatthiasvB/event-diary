// Runtime configuration, read from the environment. Kept free of SvelteKit imports
// so that the backup CLI can run this file directly with Node.
import path from 'node:path';

const env = process.env;

const dataDir = path.resolve(env.DATA_DIR ?? './data');

export const config = {
	appName: env.APP_NAME || 'Pflanzentagebuch',

	dataDir,
	/** Live SQLite databases, one per user (not backed up directly, see snapshotDir). */
	dbDir: path.join(dataDir, 'db'),
	/** Write-once photo originals. */
	photosDir: path.join(dataDir, 'photos'),
	/** Consistent database snapshots written by the backup command. */
	snapshotDir: path.join(dataDir, 'snapshot'),
	/** Regenerable thumbnails; must not be inside the backed-up paths. */
	cacheDir: path.resolve(env.CACHE_DIR ?? path.join(dataDir, 'cache')),

	vipsthumbnail: env.VIPSTHUMBNAIL || 'vipsthumbnail',

	auth: {
		/** "pam" (default) or "none" */
		backend: env.AUTH_BACKEND || 'pam',
		pamService: env.PAM_SERVICE || 'plant-diary',
		pamHelper: env.PAM_HELPER || 'plant-diary-pam-auth',
		/** Empty: every user that PAM accepts may log in. */
		allowedUsers: (env.AUTH_ALLOWED_USERS ?? '').split(/[\s,]+/).filter(Boolean),
		sessionDays: Number(env.SESSION_DAYS || 90)
	}
};
