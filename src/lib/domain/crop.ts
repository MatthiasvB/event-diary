/** Fractions of the photo as shown, with its EXIF orientation applied. */
export type Crop = { x: number; y: number; width: number; height: number };

export type Region = { left: number; top: number; width: number; height: number };

export const formatCrop = (c: Crop) => [c.x, c.y, c.width, c.height].join(',');

export function parseCrop(value: string): Crop | null {
	const parts = value.split(',').map(Number);
	if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
	const [x, y, width, height] = parts;
	const roundingError = 1e-9;
	const inside = (start: number, size: number) =>
		start >= 0 && size > 0 && start + size <= 1 + roundingError;
	return inside(x, width) && inside(y, height) ? { x, y, width, height } : null;
}

/** Where the crop lies in the pixels as stored, which an EXIF orientation turns or mirrors. */
export function storedRegion(
	crop: Crop,
	stored: { width: number; height: number },
	orientation: number
): Region {
	const { x, y, width: w, height: h } = crop;
	const flip = (start: number, size: number) => 1 - start - size;
	const [sx, sy, sw, sh] = {
		2: [flip(x, w), y, w, h],
		3: [flip(x, w), flip(y, h), w, h],
		4: [x, flip(y, h), w, h],
		5: [y, x, h, w],
		6: [y, flip(x, w), h, w],
		7: [flip(y, h), flip(x, w), h, w],
		8: [flip(y, h), x, h, w]
	}[orientation] ?? [x, y, w, h];
	const left = Math.min(Math.round(sx * stored.width), stored.width - 1);
	const top = Math.min(Math.round(sy * stored.height), stored.height - 1);
	return {
		left,
		top,
		width: Math.max(1, Math.min(Math.round(sw * stored.width), stored.width - left)),
		height: Math.max(1, Math.min(Math.round(sh * stored.height), stored.height - top))
	};
}
