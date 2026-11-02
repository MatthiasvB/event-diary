import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import exifr from 'exifr';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { config } from './config.ts';
import { openDiary } from './diarySchema.ts';
import { imageSize, saveFile } from './files.ts';

let dir: string;
beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-diary-'));
});
afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

/** EXIF with only the orientation, as a JPEG APP1 segment. */
function exifOrientation(value: number): Buffer {
	const tiff = Buffer.from([
		...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // big endian, first IFD at 8
		...[0x00, 0x01], // one entry
		...[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, value, 0x00, 0x00], // Orientation
		...[0x00, 0x00, 0x00, 0x00] // no next IFD
	]);
	const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
	const length = Buffer.alloc(2);
	length.writeUInt16BE(payload.length + 2);
	return Buffer.concat([Buffer.from([0xff, 0xe1]), length, payload]);
}

function turnedPhoto(file: string) {
	const plain = path.join(dir, 'plain.jpg');
	execFileSync('vips', ['black', plain, '40', '20']);
	const jpeg = fs.readFileSync(plain);
	fs.writeFileSync(
		file,
		Buffer.concat([jpeg.subarray(0, 2), exifOrientation(6), jpeg.subarray(2)])
	);
	fs.rmSync(plain);
	return file;
}

it('crops an upload as it is shown, and keeps its EXIF data', async () => {
	const photo = turnedPhoto(path.join(dir, 'turned.jpg'));
	config.photosDir = path.join(dir, 'photos');
	const db = openDiary(':memory:');
	const topQuarter = { x: 0, y: 0, width: 1, height: 0.25 };
	const data = new Blob([fs.readFileSync(photo)]).stream();
	const id = await saveFile(db, data, 'turned.jpg', 'image/jpeg', topQuarter);

	const row = db.prepare('SELECT file, width, height FROM files WHERE id = ?').get(id);
	expect({ ...row }).toMatchObject({ width: 20, height: 10 });
	expect(fs.readdirSync(config.photosDir)).toEqual([row?.file]);
	expect(await exifr.orientation(path.join(config.photosDir, String(row?.file)))).toBe(6);
});

it('measures images as shown, with their EXIF rotation applied', async () => {
	const plain = path.join(dir, 'plain.jpg');
	execFileSync('vips', ['black', plain, '40', '20']);
	expect(await imageSize(plain)).toEqual({ width: 40, height: 20 });

	// Taken with the phone turned: stored 40 × 20, shown 20 × 40.
	const jpeg = fs.readFileSync(plain);
	const turned = path.join(dir, 'turned.jpg');
	fs.writeFileSync(
		turned,
		Buffer.concat([jpeg.subarray(0, 2), exifOrientation(6), jpeg.subarray(2)])
	);
	expect(await imageSize(turned)).toEqual({ width: 20, height: 40 });

	const broken = path.join(dir, 'broken.jpg');
	fs.writeFileSync(broken, 'not an image');
	expect(await imageSize(broken)).toEqual({ width: 0, height: 0 });
});
