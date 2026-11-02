import { describe, expect, it } from 'vitest';
import { formatCrop, parseCrop, storedRegion } from './crop.ts';

it('reads back what it writes, and rejects crops outside the photo', () => {
	const crop = { x: 0.1, y: 0.25, width: 0.5, height: 0.75 };
	expect(parseCrop(formatCrop(crop))).toEqual(crop);
	expect(parseCrop('0,0,1,1')).toEqual({ x: 0, y: 0, width: 1, height: 1 });
	for (const bad of [
		'',
		'0,0,1',
		'0,0,1,1,1',
		'a,0,1,1',
		'-0.1,0,0.5,0.5',
		'0.6,0,0.5,0.5',
		'0,0,0,1'
	])
		expect(parseCrop(bad)).toBeNull();
});

describe('finds the crop in the stored pixels', () => {
	// A photo shown 400 × 200. The crop is its top left quarter, 100 × 50.
	const crop = { x: 0, y: 0, width: 0.25, height: 0.25 };
	const wide = { width: 400, height: 200 };
	const tall = { width: 200, height: 400 };

	it.each([
		[1, wide, { left: 0, top: 0, width: 100, height: 50 }],
		[2, wide, { left: 300, top: 0, width: 100, height: 50 }],
		[3, wide, { left: 300, top: 150, width: 100, height: 50 }],
		[4, wide, { left: 0, top: 150, width: 100, height: 50 }],
		[5, tall, { left: 0, top: 0, width: 50, height: 100 }],
		[6, tall, { left: 0, top: 300, width: 50, height: 100 }],
		[7, tall, { left: 150, top: 300, width: 50, height: 100 }],
		[8, tall, { left: 150, top: 0, width: 50, height: 100 }]
	])('with orientation %i', (orientation, stored, region) => {
		expect(storedRegion(crop, stored, orientation)).toEqual(region);
	});

	it('stays inside the photo when rounding', () => {
		const all = { x: 0.0049, y: 0.0049, width: 0.9951, height: 0.9951 };
		expect(storedRegion(all, { width: 3, height: 3 }, 1)).toEqual({
			left: 0,
			top: 0,
			width: 3,
			height: 3
		});
	});
});
