import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db.ts';

export const SESSION_COOKIE = 'session';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Creates a session and returns the token for the cookie. Only its hash is stored. */
export function createSession(
	db: Db,
	username: string,
	days: number
): { token: string; expires: Date } {
	const token = randomBytes(32).toString('base64url');
	const expires = new Date(Date.now() + days * 86_400_000);
	db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
	db.prepare('INSERT INTO sessions (token_hash, username, expires_at) VALUES (?, ?, ?)').run(
		hash(token),
		username,
		expires.getTime()
	);
	return { token, expires };
}

export function sessionUser(db: Db, token: string | undefined): string | null {
	if (!token) return null;
	const row = db
		.prepare('SELECT username FROM sessions WHERE token_hash = ? AND expires_at > ?')
		.get(hash(token), Date.now()) as { username: string } | undefined;
	return row?.username ?? null;
}

export function deleteSession(db: Db, token: string) {
	db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
}
