import { expect, it } from 'vitest';
import { cropOf, keptInside } from './crop.ts';

const photo = { width: 400, height: 200 };
const current = { x: 100, y: 50, width: 200, height: 100 };

it('lets a selection inside the photo be', () => {
	expect(keptInside({ ...current, x: 200 }, current, photo)).toBeNull();
	expect(keptInside({ x: 0, y: 0, ...photo }, current, photo)).toBeNull();
});

it('stops a moved selection at the edge, and cuts a resized one off there', () => {
	expect(keptInside({ ...current, x: 250, y: -20 }, current, photo)).toEqual({
		...current,
		x: 200,
		y: 0
	});
	expect(keptInside({ x: -30, y: 50, width: 330, height: 180 }, current, photo)).toEqual({
		x: 0,
		y: 50,
		width: 300,
		height: 150
	});
});

it('crops nothing when the selection covers the photo, give or take a pixel', () => {
	expect(cropOf({ x: 1, y: 0, width: 398, height: 200 }, photo)).toBeNull();
	expect(cropOf({ x: 0, y: 0, width: 200, height: 200 }, photo)).toEqual({
		x: 0,
		y: 0,
		width: 0.5,
		height: 1
	});
	expect(cropOf(current, photo)).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
});
