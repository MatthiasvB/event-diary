// Stored attachments (photos, videos, other files) and photo thumbnails. Files are kept
// unchanged under a new ID in photos/ and never modified.
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { promisify } from 'node:util';
import exifr from 'exifr';
import { fileKind } from '../files.ts';
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
// For uploads without a type (e.g. HEIC on some systems).
const MIME_BY_EXT: Record<string, string> = Object.fromEntries([
	...Object.entries(EXTENSIONS).map(([m, e]) => [e, m]),
	['jpeg', 'image/jpeg'],
	['mp4', 'video/mp4'],
	['mov', 'video/quicktime'],
	['webm', 'video/webm'],
	['pdf', 'application/pdf'],
	['txt', 'text/plain']
]);
/** Formats every browser can show; others (HEIC) are only shown as thumbnails. */
const BROWSER_SAFE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
/**
 * Served for display in the browser. Anything else (HTML, SVG, …) is only ever offered as
 * a download, so a file can't run as part of the app, e.g. in a shared diary.
 */
const INLINE =
	/^(image\/(jpeg|png|webp|gif|avif)|video\/[\w.+-]+|audio\/[\w.+-]+|application\/pdf|text\/plain)$/;

export const SIZES = { s: 480, l: 1600 } as const;
export type Size = keyof typeof SIZES;

export const FILE_ID = /^[0-9a-f-]{36}$/;

type Row = { id: string; file: string; mime: string; original_name: string };

/**
 * Stores an upload (photo, video or any file) unchanged under a new stable ID. The data is
 * streamed to disk, so even a large video is never held in memory.
 */
export async function saveFile(
	db: Db,
	data: ReadableStream<Uint8Array>,
	originalName: string,
	type: string
): Promise<string> {
	const ext = /\.([a-z0-9]{1,10})$/i.exec(originalName)?.[1].toLowerCase() ?? '';
	const mime = (type || MIME_BY_EXT[ext] || 'application/octet-stream').toLowerCase();
	const id = randomUUID();
	const name = ext ? `${id}.${ext}` : id;
	const target = path.join(config.photosDir, name);
	fs.mkdirSync(config.photosDir, { recursive: true });
	try {
		await pipeline(
			Readable.fromWeb(data as NodeReadableStream),
			fs.createWriteStream(target, { flags: 'wx', mode: 0o640 })
		);
	} catch (e) {
		fs.rmSync(target, { force: true });
		throw e;
	}

	const image = fileKind(mime, originalName) === 'image';
	const taken = image ? await captureTime(target) : null;
	const size = image ? await imageSize(target) : null;
	db.prepare(
		'INSERT INTO files (id, file, mime, original_name, taken_at, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)'
	).run(id, name, mime, originalName, taken, size?.width ?? null, size?.height ?? null);
	return id;
}

/**
 * Width and height of an image as it is shown, i.e. with its EXIF rotation applied (as the
 * thumbnails are). 0 × 0 if it can't be read.
 */
export async function imageSize(file: string): Promise<{ width: number; height: number }> {
	try {
		const header = async (field: string) =>
			Number((await run(config.vipsheader, ['-f', field, file])).stdout.trim());
		const [width, height] = [await header('width'), await header('height')];
		const orientation = await exifr.orientation(file).catch(() => undefined);
		// Orientations 5 to 8 turn the image by 90°.
		const turned = typeof orientation === 'number' && orientation >= 5;
		if (!(width > 0 && height > 0)) return { width: 0, height: 0 };
		return turned ? { width: height, height: width } : { width, height };
	} catch {
		return { width: 0, height: 0 };
	}
}

/** Measures images stored before sizes were recorded, one after the other. */
export async function measureOldImages(db: Db) {
	const rows = db
		.prepare("SELECT id, file FROM files WHERE width IS NULL AND mime LIKE 'image/%'")
		.all() as { id: string; file: string }[];
	for (const r of rows) {
		const { width, height } = await imageSize(path.join(config.photosDir, r.file));
		db.prepare('UPDATE files SET width = ?, height = ? WHERE id = ?').run(width, height, r.id);
	}
}

/** Whether all these files exist (uploads that weren't attached are removed after a day). */
export function filesExist(db: Db, ids: string[]): boolean {
	const exists = db.prepare('SELECT 1 FROM files WHERE id = ?');
	return ids.every((id) => exists.get(id));
}

/**
 * Files are uploaded one by one before the form that uses them is saved. Those never
 * attached (form abandoned) are removed after a day.
 */
export function deleteStaleUploads(db: Db) {
	const stale = db
		.prepare(
			`SELECT id FROM files WHERE created_at < datetime('now', '-1 day')
			AND id NOT IN (SELECT file_id FROM event_files)
			AND id NOT IN (SELECT cover_photo_id FROM objects WHERE cover_photo_id IS NOT NULL)`
		)
		.all() as { id: string }[];
	deleteFiles(
		db,
		stale.map((r) => r.id)
	);
}

/** EXIF capture time as local "YYYY-MM-DDTHH:MM:SS", if present. */
export async function captureTime(data: string | Uint8Array): Promise<string | null> {
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

export function getFile(db: Db, id: string): (Row & { path: string }) | undefined {
	const row = db.prepare('SELECT id, file, mime, original_name FROM files WHERE id = ?').get(id) as
		Row | undefined;
	return row && { ...row, path: path.join(config.photosDir, row.file) };
}

const pending = new Map<string, Promise<string | null>>();

/**
 * A resized, auto-rotated JPEG of the photo, generated into the cache on first request.
 * Returns null if it can't be generated.
 */
export function thumbnail(db: Db, id: string, size: Size): Promise<string | null> {
	const photo = getFile(db, id);
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

export function servesInline(mime: string) {
	return INLINE.test(mime);
}

/** Removes files (rows, originals, cached thumbnails) that no event references any more. */
export function deleteFiles(db: Db, ids: string[]) {
	for (const id of ids) {
		const photo = getFile(db, id);
		if (!photo) continue;
		db.prepare('DELETE FROM files WHERE id = ?').run(id);
		fs.rmSync(photo.path, { force: true });
		for (const px of Object.values(SIZES)) {
			fs.rmSync(path.join(config.cacheDir, 'thumbs', `${id}-${px}.jpg`), { force: true });
		}
	}
}
