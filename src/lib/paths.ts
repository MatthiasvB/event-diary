// In-app URLs live under the current diary: /<diary>/…
import { resolve } from '$app/paths';
import { page } from '$app/state';

/** The current diary, from the URL. */
export function diaryId(): string {
	return page.params.diary ?? '';
}

/** A photo of the current diary: resized ("s", "l") or the original file. */
export function photoUrl(id: string, size: 's' | 'l' | 'original') {
	return resolve(`/[diary]/photos/[id]?size=${size}`, { diary: diaryId(), id });
}

/** Whether the user may change the current diary (viewers may only look). */
export function canEdit(): boolean {
	return (page.data.diary as { role?: string } | undefined)?.role !== 'viewer';
}
