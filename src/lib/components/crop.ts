import type { Crop } from '../domain/crop.ts';

export type Box = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

/**
 * The box to use instead of `next` when it leaves the photo, or null when it fits. A moved box
 * stops at the edge, a resized one is cut off there.
 */
export function keptInside(next: Box, current: Box, photo: Size): Box | null {
	const fits =
		next.x >= 0 &&
		next.y >= 0 &&
		next.x + next.width <= photo.width &&
		next.y + next.height <= photo.height;
	if (fits) return null;
	if (next.width === current.width && next.height === current.height) {
		const clamp = (start: number, size: number, max: number) =>
			Math.min(Math.max(start, 0), max - size);
		return {
			...next,
			x: clamp(next.x, next.width, photo.width),
			y: clamp(next.y, next.height, photo.height)
		};
	}
	const x = Math.max(next.x, 0);
	const y = Math.max(next.y, 0);
	const width = Math.min(next.x + next.width, photo.width) - x;
	const height = Math.min(next.y + next.height, photo.height) - y;
	return width > 0 && height > 0 ? { x, y, width, height } : current;
}

/** Null when the selection covers the whole photo, give or take a pixel. */
export function cropOf(selection: Box, photo: Size): Crop | null {
	const whole =
		selection.x <= 1 &&
		selection.y <= 1 &&
		selection.x + selection.width >= photo.width - 1 &&
		selection.y + selection.height >= photo.height - 1;
	if (whole) return null;
	return {
		x: selection.x / photo.width,
		y: selection.y / photo.height,
		width: selection.width / photo.width,
		height: selection.height / photo.height
	};
}

export async function croppedPreview(file: File, crop: Crop, size = 320): Promise<string> {
	const url = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.src = url;
		await image.decode();
		const { naturalWidth: nw, naturalHeight: nh } = image;
		const [w, h] = [crop.width * nw, crop.height * nh];
		const scale = Math.min(1, size / Math.max(w, h));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(w * scale);
		canvas.height = Math.round(h * scale);
		const context = canvas.getContext('2d');
		context?.drawImage(image, crop.x * nw, crop.y * nh, w, h, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob>((done, fail) =>
			canvas.toBlob((b) => (b ? done(b) : fail(new Error('No preview'))), 'image/jpeg', 0.85)
		);
		return URL.createObjectURL(blob);
	} finally {
		URL.revokeObjectURL(url);
	}
}
