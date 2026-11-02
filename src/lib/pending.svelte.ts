import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { offerCrop } from './offerCrop.svelte.ts';
import { diaryId } from './paths.ts';
import { pickedFiles, uncropped, type Upload } from './upload.ts';

export const pendingPhotos: { files: Upload[] } = $state({ files: [] });

export async function startPhotoEvent(e: Event, objectId?: number) {
	const files = pickedFiles(e);
	if (files.length) await openPhotoEvent(files.map(uncropped), objectId);
}

export async function startCameraEvent(e: Event, objectId?: number) {
	const [photo] = pickedFiles(e);
	if (photo) await openPhotoEvent([await offerCrop(photo)], objectId);
}

export async function openPhotoEvent(files: Upload[], objectId?: number) {
	pendingPhotos.files = files;
	const object = objectId ? `&object=${objectId}` : '';
	await goto(resolve(`/[diary]/events/new?photo=1${object}`, { diary: diaryId() }));
}
