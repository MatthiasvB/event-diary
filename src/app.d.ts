// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			/** Logged-in user; null when the auth backend requires no login. */
			user: string | null;
		}
	}
}

export {};
