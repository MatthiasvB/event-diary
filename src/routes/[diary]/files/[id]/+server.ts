import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import {
	FILE_ID,
	getFile,
	isBrowserSafe,
	servesInline,
	SIZES,
	thumbnail,
	type Size
} from '#lib/server/files.ts';
import { fileKind } from '#lib/files.ts';
import type { RequestHandler } from './$types';

// Files never change once uploaded.
const IMMUTABLE = 'private, max-age=31536000, immutable';

type SendOptions = { downloadName?: string; range?: string | null };

/** Sends a file, or the requested byte range of it (video players seek with ranges). */
function send(file: string, type: string, { downloadName, range }: SendOptions = {}) {
	const size = fs.statSync(file).size;
	const headers: Record<string, string> = {
		'content-type': type,
		'cache-control': IMMUTABLE,
		'accept-ranges': 'bytes',
		'x-content-type-options': 'nosniff'
	};
	if (downloadName) {
		headers['content-disposition'] =
			`attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
	}

	const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
	if (m && (m[1] || m[2])) {
		// "bytes=500-", "bytes=500-999" or the last n bytes: "bytes=-500"
		const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
		const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
		if (start >= size || start > end) {
			return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
		}
		const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
		headers['content-range'] = `bytes ${start}-${end}/${size}`;
		headers['content-length'] = String(end - start + 1);
		return new Response(stream, { status: 206, headers });
	}

	const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
	headers['content-length'] = String(size);
	return new Response(stream, { headers });
}

/**
 * /files/:id?size=s|l: resized JPEG of a photo
 * /files/:id?size=original: the file as uploaded (any kind); &download=1 as a download
 */
export const GET: RequestHandler = async ({ params, url, request }) => {
	if (!FILE_ID.test(params.id)) error(404);
	const d = db();
	const file = getFile(d, params.id);
	if (!file || !fs.existsSync(file.path)) error(404);
	const name = file.original_name || file.file;

	const size = url.searchParams.get('size') ?? 'l';
	if (size === 'original') {
		// Types a browser could run as code (HTML, SVG, …) are only ever downloads.
		const inline = servesInline(file.mime) && !url.searchParams.has('download');
		return send(file.path, inline ? file.mime : 'application/octet-stream', {
			downloadName: inline ? undefined : name,
			range: request.headers.get('range')
		});
	}
	if (!(size in SIZES) || fileKind(file.mime, name) !== 'image') error(404);

	const thumb = await thumbnail(d, file.id, size as Size);
	if (thumb) return send(thumb, 'image/jpeg');
	// Without a thumbnail, fall back to the original if browsers can show it.
	if (isBrowserSafe(file.mime)) return send(file.path, file.mime);
	error(500, 'Thumbnail generation failed');
};
