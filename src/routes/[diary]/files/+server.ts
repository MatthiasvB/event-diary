import { error, json } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { deleteStaleUploads, saveFile } from '#lib/server/files.ts';
import type { RequestHandler } from './$types';

/** The body is the file. Its name comes URI-encoded in the x-file-name header. */
export const POST: RequestHandler = async ({ request }) => {
	if (!request.body) error(400);
	const d = db();
	const name = decodeURIComponent(request.headers.get('x-file-name') ?? '') || 'Datei';
	const id = await saveFile(d, request.body, name, request.headers.get('content-type') ?? '');
	deleteStaleUploads(d);
	return json({ id });
};
