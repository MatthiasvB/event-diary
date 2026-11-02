import { expect, it } from 'vitest';
import { sortObjects } from './objectOrder.ts';

const object = (name: string, last: string | null) => ({
	name,
	stats: { last: last === null ? null : { date: last } }
});
const objects = [
	object('Zamioculcas', '2026-10-01'),
	object('Ölbaum', null),
	object('Aloe', '2026-09-15'),
	object('Monstera', '2026-10-01'),
	object('Efeu', null)
];
const names = (list: { name: string }[]) => list.map((o) => o.name);

it('sorts by name as German speakers expect', () => {
	expect(names(sortObjects(objects, 'name'))).toEqual([
		'Aloe',
		'Efeu',
		'Monstera',
		'Ölbaum',
		'Zamioculcas'
	]);
});

it('puts the most recently active first, and objects without events last', () => {
	expect(names(sortObjects(objects, 'recent'))).toEqual([
		'Monstera',
		'Zamioculcas',
		'Aloe',
		'Efeu',
		'Ölbaum'
	]);
});
