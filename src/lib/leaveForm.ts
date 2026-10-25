// A submitted form doesn't stay in the browser history: "back" from the page it leads to
// must not land on the form again.
import { afterNavigate, goto } from '$app/navigation';
import type { ActionResult } from '$app/forms';

type Submitted = {
	result: ActionResult;
	update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
};

/**
 * Call while a form component initializes. Returns a result handler for `use:enhance`:
 * after a redirect, it goes back if the target is the page the form was opened from, and
 * otherwise replaces the form's history entry with the target. Other results update the
 * form as usual.
 */
export function leaveFormOnRedirect() {
	let origin: string | null = null;
	afterNavigate(({ from }) => {
		origin = from ? from.url.pathname + from.url.search : null;
	});

	return async ({ result, update }: Submitted) => {
		if (result.type !== 'redirect') return update({ reset: false });
		const target = new URL(result.location, location.href);
		const path = target.pathname + target.search;
		if (path === origin) history.back();
		// The location comes from our own form action, i.e. it is an app path already.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		else await goto(path, { replace: true });
	};
}
