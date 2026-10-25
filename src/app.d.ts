// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			/** Logged-in user; null when the auth backend requires no login. */
			user: string | null;
		}
		interface PageState {
			/** ID of the open photo viewer (shallow history entry, so "back" closes it). */
			viewer?: string;
		}
	}
}

export {};
