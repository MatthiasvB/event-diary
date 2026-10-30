import { config } from '../config.ts';
import { pamBackend } from './pam.ts';

export interface AuthBackend {
	readonly requiresLogin: boolean;
	checkPassword(username: string, password: string): Promise<boolean>;
}

const noneBackend: AuthBackend = {
	requiresLogin: false,
	checkPassword: async () => true
};

const backends: Record<string, () => AuthBackend> = {
	pam: () => pamBackend(config.auth.pamHelper, config.auth.pamService),
	none: () => noneBackend
};

let instance: AuthBackend | undefined;

export function auth(): AuthBackend {
	if (!instance) {
		const make = backends[config.auth.backend];
		if (!make) throw new Error(`Unknown AUTH_BACKEND "${config.auth.backend}"`);
		instance = make();
	}
	return instance;
}

export function isAllowed(username: string): boolean {
	const allowed = config.auth.allowedUsers;
	return !allowed.length || allowed.includes(username);
}

const failures = new Map<string, { count: number; until: number }>();

export function isThrottled(username: string): boolean {
	return (failures.get(username)?.until ?? 0) > Date.now();
}

export function recordFailure(username: string) {
	const f = failures.get(username) ?? { count: 0, until: 0 };
	f.count++;
	if (f.count >= 5) f.until = Date.now() + (f.count - 4) * 60_000;
	failures.set(username, f);
}

export function recordSuccess(username: string) {
	failures.delete(username);
}
