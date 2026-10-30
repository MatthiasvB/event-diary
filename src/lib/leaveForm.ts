import { afterNavigate, goto, invalidate } from '$app/navigation';
import { FIELD_KINDS_DATA } from './fieldKinds.ts';
import type { ActionResult } from '$app/forms';

type Submitted = {
	result: ActionResult;
	update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
};

/**
 * "Back" from the page a saved form leads to must not land on the form again. Call while the
 * form component initializes.
 */
export function leaveFormOnRedirect() {
	let origin: string | null = null;
	afterNavigate(({ from }) => {
		origin = from ? from.url.pathname + from.url.search : null;
	});

	return async ({ result, update }: Submitted) => {
		if (result.type !== 'redirect') return update({ reset: false });
		// Saving may have given new field names a kind.
		await invalidate(FIELD_KINDS_DATA);
		const target = new URL(result.location, location.href);
		const path = target.pathname + target.search;
		if (path === origin) history.back();
		// The location comes from our own form action, i.e. it is an app path already.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		else await goto(path, { replace: true });
	};
}
