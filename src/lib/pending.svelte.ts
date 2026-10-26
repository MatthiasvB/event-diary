import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { diaryId } from './paths.ts';

// Photos taken with a camera button, handed to the event form.
export const pendingPhotos: { files: File[] } = $state({ files: [] });

/**
 * Camera shortcut: after taking a photo, open the event form in photo mode
 * (photo event type and capture date prefilled), optionally for a given object.
 */
export async function startPhotoEvent(e: Event, objectId?: number) {
	const input = e.currentTarget as HTMLInputElement;
	const files = [...(input.files ?? [])];
	input.value = '';
	if (files.length) await openPhotoEvent(files, objectId);
}

/** Opens the event form in photo mode with these files, e.g. dropped onto an object. */
export async function openPhotoEvent(files: File[], objectId?: number) {
	pendingPhotos.files = files;
	const object = objectId ? `&object=${objectId}` : '';
	await goto(resolve(`/[diary]/events/new?photo=1${object}`, { diary: diaryId() }));
}
