// Login sessions, stored in the registry (diaries are separate databases).
import { createHash, randomBytes } from 'node:crypto';
import { registry } from '../registry.ts';

export const SESSION_COOKIE = 'session';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Creates a session and returns the token for the cookie. Only its hash is stored. */
export function createSession(username: string, days: number): { token: string; expires: Date } {
	const token = randomBytes(32).toString('base64url');
	const expires = new Date(Date.now() + days * 86_400_000);
	const reg = registry();
	reg.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
	reg
		.prepare('INSERT INTO sessions (token_hash, username, expires_at) VALUES (?, ?, ?)')
		.run(hash(token), username, expires.getTime());
	return { token, expires };
}

export function sessionUser(token: string | undefined): string | null {
	if (!token) return null;
	const row = registry()
		.prepare('SELECT username FROM sessions WHERE token_hash = ? AND expires_at > ?')
		.get(hash(token), Date.now()) as { username: string } | undefined;
	return row?.username ?? null;
}

export function deleteSession(token: string) {
	registry().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token));
}
