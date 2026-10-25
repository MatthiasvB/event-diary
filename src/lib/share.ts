// Web Share Target (Android): images shared from other apps are posted to SHARE_PATH.
// The service worker keeps them in a cache until the event form takes them.

export const SHARE_PATH = '/share';
export const SHARE_CACHE = 'shared-photos';
const NAME_HEADER = 'x-file-name';

/** Service worker: store shared files in order. */
export async function storeSharedPhotos(files: File[]) {
	await caches.delete(SHARE_CACHE);
	const cache = await caches.open(SHARE_CACHE);
	for (const [i, file] of files.entries()) {
		const headers = { 'content-type': file.type, [NAME_HEADER]: encodeURIComponent(file.name) };
		await cache.put(`/shared-photos/${i}`, new Response(file, { headers }));
	}
}

/** Event form: take the shared files (once). */
export async function takeSharedPhotos(): Promise<File[]> {
	if (!('caches' in globalThis)) return [];
	const cache = await caches.open(SHARE_CACHE);
	const files: File[] = [];
	for (const request of await cache.keys()) {
		const response = await cache.match(request);
		if (!response) continue;
		const name = decodeURIComponent(response.headers.get(NAME_HEADER) ?? 'Foto');
		const type = response.headers.get('content-type') ?? '';
		files.push(new File([await response.blob()], name, { type }));
	}
	await caches.delete(SHARE_CACHE);
	return files;
}
