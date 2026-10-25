import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

// Photos taken with a camera button, handed to the event form.
export const pendingPhotos: { files: File[] } = $state({ files: [] });

/**
 * Camera shortcut: after taking a photo, open the event form in photo mode
 * (photo event type and capture date prefilled), optionally for a given plant.
 */
export async function startPhotoEvent(e: Event, plantId?: string) {
	const input = e.currentTarget as HTMLInputElement;
	if (!input.files?.length) return;
	pendingPhotos.files = [...input.files];
	input.value = '';
	const plant = plantId ? `&plant=${encodeURIComponent(plantId)}` : '';
	await goto(resolve(`/events/new?photo=1${plant}`));
}
