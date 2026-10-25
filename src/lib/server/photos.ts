import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import exifr from 'exifr';
import { config } from './config.ts';
import type { Db } from './db.ts';

const run = promisify(execFile);

const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif',
	'image/heic': 'heic',
	'image/heif': 'heif'
};
const MIME_BY_EXT = Object.fromEntries([
	...Object.entries(EXTENSIONS).map(([m, e]) => [e, m]),
	['jpeg', 'image/jpeg']
]);
/** Formats every browser can show; others (HEIC) are only shown as thumbnails. */
const BROWSER_SAFE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const SIZES = { s: 480, l: 1600 } as const;
export type Size = keyof typeof SIZES;

export const PHOTO_ID = /^[0-9a-f-]{36}$/;

type Row = { id: string; file: string; mime: string; original_name: string };

/** Stores an upload unchanged under a new stable ID. Returns the ID. */
export async function savePhoto(db: Db, file: File): Promise<string> {
	const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
	const mime = EXTENSIONS[file.type] ? file.type : MIME_BY_EXT[ext];
	if (!mime) throw new Error(`Unsupported image type: ${file.type || file.name}`);

	const data = Buffer.from(await file.arrayBuffer());
	const id = randomUUID();
	const name = `${id}.${EXTENSIONS[mime]}`;
	fs.mkdirSync(config.photosDir, { recursive: true });
	fs.writeFileSync(path.join(config.photosDir, name), data, { flag: 'wx', mode: 0o640 });

	db.prepare(
		'INSERT INTO photos (id, file, mime, original_name, taken_at) VALUES (?, ?, ?, ?, ?)'
	).run(id, name, mime, file.name, await captureTime(data));
	return id;
}

/** EXIF capture time as local "YYYY-MM-DDTHH:MM:SS", if present. */
export async function captureTime(data: Uint8Array): Promise<string | null> {
	try {
		const exif = await exifr.parse(data, ['DateTimeOriginal', 'CreateDate']);
		const d: unknown = exif?.DateTimeOriginal ?? exif?.CreateDate;
		if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	} catch {
		return null;
	}
}

export function getPhoto(db: Db, id: string): (Row & { path: string }) | undefined {
	const row = db
		.prepare('SELECT id, file, mime, original_name FROM photos WHERE id = ?')
		.get(id) as Row | undefined;
	return row && { ...row, path: path.join(config.photosDir, row.file) };
}

const pending = new Map<string, Promise<string | null>>();

/**
 * A resized, auto-rotated JPEG of the photo, generated into the cache on first request.
 * Returns null if it can't be generated.
 */
export function thumbnail(db: Db, id: string, size: Size): Promise<string | null> {
	const photo = getPhoto(db, id);
	if (!photo) return Promise.resolve(null);
	const target = path.join(config.cacheDir, 'thumbs', `${id}-${SIZES[size]}.jpg`);
	if (fs.existsSync(target)) return Promise.resolve(target);

	let job = pending.get(target);
	if (!job) {
		job = generate(photo.path, target, SIZES[size]).finally(() => pending.delete(target));
		pending.set(target, job);
	}
	return job;
}

async function generate(source: string, target: string, px: number): Promise<string | null> {
	fs.mkdirSync(path.dirname(target), { recursive: true });
	const tmp = `${target.slice(0, -4)}.${process.pid}.tmp.jpg`;
	try {
		await run(config.vipsthumbnail, [source, '--size', `${px}x${px}`, '-o', `${tmp}[Q=82,strip]`]);
		fs.renameSync(tmp, target);
		return target;
	} catch (e) {
		console.error(`Thumbnail for ${source} failed:`, e);
		fs.rmSync(tmp, { force: true });
		return null;
	}
}

export function isBrowserSafe(mime: string) {
	return BROWSER_SAFE.has(mime);
}

/** Removes photos (rows, originals, cached thumbnails) that no event references any more. */
export function deletePhotos(db: Db, ids: string[]) {
	for (const id of ids) {
		const photo = getPhoto(db, id);
		if (!photo) continue;
		db.prepare('DELETE FROM photos WHERE id = ?').run(id);
		fs.rmSync(photo.path, { force: true });
		for (const px of Object.values(SIZES)) {
			fs.rmSync(path.join(config.cacheDir, 'thumbs', `${id}-${px}.jpg`), { force: true });
		}
	}
}
