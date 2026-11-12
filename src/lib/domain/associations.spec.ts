import { expect, it } from 'vitest';
import {
	formatTarget,
	parseTarget,
	pathOf,
	pointingTo,
	targetName,
	type CurrentValues
} from './associations.ts';

it('tells an object that exists from one to create', () => {
	expect(parseTarget(formatTarget({ id: 12 }))).toEqual({ id: 12 });
	expect(parseTarget(formatTarget({ name: 'Auto' }))).toEqual({ name: 'Auto' });
	expect(parseTarget(formatTarget({ name: '12' }))).toEqual({ name: '12' });
	for (const bad of ['', '+', '+  ', 'Auto', '0', '12a', '-3']) expect(parseTarget(bad)).toBeNull();

	const names = new Map([[12, 'Fernbedienung']]);
	const nameOf = (id: number) => names.get(id);
	expect(targetName('12', nameOf)).toBe('Fernbedienung');
	expect(targetName('+Auto', nameOf)).toBe('Auto');
	expect(targetName('13', nameOf)).toBeUndefined();
});

// Akku in Fernbedienung in Wohnzimmer. Uhr in Wohnzimmer. Pflanze has no "In".
const current: CurrentValues = new Map<number, Record<string, string>>([
	[1, { In: '2', Farbe: 'grün' }],
	[2, { In: '3' }],
	[3, {}],
	[4, { In: '3' }],
	[5, { Standort: '3' }]
]);

it('follows an association to where it leads', () => {
	expect(pathOf(1, 'In', current)).toEqual([2, 3]);
	expect(pathOf(3, 'In', current)).toEqual([]);
	expect(pathOf(1, 'Standort', current)).toEqual([]);
});

it('stops at a loop instead of following it forever', () => {
	const loop: CurrentValues = new Map<number, Record<string, string>>([
		[1, { In: '2' }],
		[2, { In: '1' }]
	]);
	expect(pathOf(1, 'In', loop)).toEqual([2]);
});

it('finds what is associated with an object, per association', () => {
	expect(pointingTo(3, ['In', 'Standort'], current)).toEqual([
		{ key: 'In', ids: [2, 4] },
		{ key: 'Standort', ids: [5] }
	]);
	expect(pointingTo(1, ['In'], current)).toEqual([]);
});
