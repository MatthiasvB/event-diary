// Runtime configuration, read from the environment. Kept free of SvelteKit imports
// so that the backup CLI can run this file directly with Node.
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
	/** Live SQLite databases, one per user (not backed up directly, see snapshotDir). */
	dbDir: path.join(dataDir, 'db'),
	/** Write-once photo originals. */
	photosDir: path.join(dataDir, 'photos'),
	/** Consistent database snapshots written by the backup command. */
	snapshotDir: path.join(dataDir, 'snapshot'),
	/** Regenerable thumbnails; must not be inside the backed-up paths. */
	cacheDir: path.resolve(env.CACHE_DIR ?? path.join(dataDir, 'cache')),

	vipsthumbnail: env.VIPSTHUMBNAIL || 'vipsthumbnail',
	/** Next to vipsthumbnail, from the same package. */
	vipsheader: env.VIPSTHUMBNAIL
		? path.join(path.dirname(env.VIPSTHUMBNAIL), 'vipsheader')
		: 'vipsheader',
	/** Largest request adapter-node accepts, so the largest file that can be uploaded. */
	maxUploadBytes: bytes(env.BODY_SIZE_LIMIT || '512K'),

	auth: {
		/** "pam" (default) or "none" */
		backend: env.AUTH_BACKEND || 'pam',
		pamService: env.PAM_SERVICE || 'event-diary',
		pamHelper: env.PAM_HELPER || 'event-diary-pam-auth',
		/** Empty: every user that PAM accepts may log in. */
		allowedUsers: (env.AUTH_ALLOWED_USERS ?? '').split(/[\s,]+/).filter(Boolean),
		sessionDays: Number(env.SESSION_DAYS || 90)
	}
};
