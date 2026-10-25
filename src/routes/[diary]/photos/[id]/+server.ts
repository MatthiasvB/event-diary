import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import {
	getPhoto,
	isBrowserSafe,
	PHOTO_ID,
	SIZES,
	thumbnail,
	type Size
} from '#lib/server/photos.ts';
import type { RequestHandler } from './$types';

// Photos never change once uploaded.
const IMMUTABLE = 'private, max-age=31536000, immutable';

function send(file: string, type: string, downloadName?: string) {
	const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
	const headers: Record<string, string> = {
		'content-type': type,
		'content-length': String(fs.statSync(file).size),
		'cache-control': IMMUTABLE
	};
	if (downloadName) {
		headers['content-disposition'] =
			`attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
	}
	return new Response(stream, { headers });
}

/** /photos/:id?size=s|l (resized JPEG) or ?size=original */
export const GET: RequestHandler = async ({ params, url }) => {
	if (!PHOTO_ID.test(params.id)) error(404);
	const d = db();
	const photo = getPhoto(d, params.id);
	if (!photo || !fs.existsSync(photo.path)) error(404);

	const size = url.searchParams.get('size') ?? 'l';
	if (size === 'original') return send(photo.path, photo.mime, photo.original_name || photo.file);
	if (!(size in SIZES)) error(400);

	const thumb = await thumbnail(d, photo.id, size as Size);
	if (thumb) return send(thumb, 'image/jpeg');
	// Without a thumbnail, fall back to the original if browsers can show it.
	if (isBrowserSafe(photo.mime)) return send(photo.path, photo.mime);
	error(500, 'Thumbnail generation failed');
};
