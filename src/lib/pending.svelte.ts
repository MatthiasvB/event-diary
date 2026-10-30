import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { diaryId } from './paths.ts';

export const pendingPhotos: { files: File[] } = $state({ files: [] });

export async function startPhotoEvent(e: Event, objectId?: number) {
	const input = e.currentTarget as HTMLInputElement;
	const files = [...(input.files ?? [])];
	input.value = '';
	if (files.length) await openPhotoEvent(files, objectId);
}

export async function openPhotoEvent(files: File[], objectId?: number) {
	pendingPhotos.files = files;
	const object = objectId ? `&object=${objectId}` : '';
	await goto(resolve(`/[diary]/events/new?photo=1${object}`, { diary: diaryId() }));
}
