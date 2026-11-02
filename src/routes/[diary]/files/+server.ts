import { error, json } from '@sveltejs/kit';
import { parseCrop } from '#lib/domain/crop.ts';
import { db } from '#lib/server/diary.ts';
import { deleteStaleUploads, saveFile } from '#lib/server/files.ts';
import type { RequestHandler } from './$types';

/** The body is the file. Its name comes URI-encoded in the x-file-name header. */
export const POST: RequestHandler = async ({ request }) => {
	if (!request.body) error(400);
	const d = db();
	const name = decodeURIComponent(request.headers.get('x-file-name') ?? '') || 'Datei';
	const cropHeader = request.headers.get('x-crop');
	const crop = cropHeader === null ? null : (parseCrop(cropHeader) ?? error(400));
	const type = request.headers.get('content-type') ?? '';
	const id = await saveFile(d, request.body, name, type, crop);
	deleteStaleUploads(d);
	return json({ id });
};
