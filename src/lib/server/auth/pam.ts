// Checks system account passwords through PAM, using a small helper binary
// (pam-helper/, a small Rust program) so that no native Node module is needed.
import { spawn } from 'node:child_process';
import type { AuthBackend } from './index.ts';

export const USERNAME = /^[a-z_][a-z0-9_.-]{0,31}\$?$/i;

export function pamBackend(helper: string, service: string): AuthBackend {
	return {
		requiresLogin: true,
		checkPassword(username, password) {
			if (!USERNAME.test(username) || /[\n\0]/.test(password) || !password) {
				return Promise.resolve(false);
			}
			return new Promise((resolve) => {
				const child = spawn(helper, [service], { stdio: ['pipe', 'ignore', 'inherit'] });
				const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
				child.on('error', (e) => {
					console.error('PAM helper failed to start:', e.message);
					clearTimeout(timer);
					resolve(false);
				});
				child.on('close', (code) => {
					clearTimeout(timer);
					resolve(code === 0);
				});
				child.stdin.end(`${username}\n${password}\n`);
			});
		}
	};
}
