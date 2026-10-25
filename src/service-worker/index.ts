// Only receives images shared from other apps (Android share sheet, see the manifest's
// share_target). It does not cache the app; everything else goes to the network as usual.
import { self } from '$app/service-worker';
import { SHARE_PATH, storeSharedPhotos } from '../lib/share.ts';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'POST' || url.pathname !== SHARE_PATH) return;
	event.respondWith(receiveShare(event.request));
});

async function receiveShare(request: Request): Promise<Response> {
	const form = await request.formData();
	const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
	await storeSharedPhotos(files);
	// Then continue like the camera shortcut: photo mode of the event form.
	return Response.redirect(
		new URL(`/events/new?photo=1&shared=${files.length}`, self.location.origin),
		303
	);
}
