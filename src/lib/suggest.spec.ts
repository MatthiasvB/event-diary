import { describe, expect, it } from 'vitest';
import {
	distance,
	findSimilar,
	nearDuplicates,
	normalize,
	rank,
	type Candidate
} from './suggest.ts';

const today = '2026-10-25';
const values = (s: { value: string }[]) => s.map((x) => x.value);

describe('normalize', () => {
	it('ignores case, umlauts, ß and extra whitespace', () => {
		expect(normalize('  Düngen ')).toBe(normalize('duengen'));
		expect(normalize('DUNGEN')).toBe(normalize('Düngen'));
		expect(normalize('Topfgröße')).toBe(normalize('topfgroesse'));
		expect(normalize('Ost   fenster')).toBe('ost fenster');
	});
});

describe('distance', () => {
	it('counts edits and transpositions', () => {
		expect(distance('catleya', 'cattleya')).toBe(1);
		expect(distance('phalaenopis', 'phalaenopsis')).toBe(1);
		expect(distance('ab', 'ba')).toBe(1);
		expect(distance('', 'abc')).toBe(3);
	});
});

describe('rank', () => {
	const locations: Candidate[] = [
		{ value: 'Ostfenster', count: 9, last: '2026-09-20' },
		{ value: 'Südfenster', count: 3, last: '2026-09-01' },
		{ value: 'zwischen Südfenstern', count: 6, last: '2026-09-23' },
		{ value: 'Esszimmertisch', count: 1, last: '2026-10-10' }
	];

	it('prefers prefix over word over substring matches', () => {
		expect(values(rank('süd', locations, { today }))).toEqual([
			'Südfenster',
			'zwischen Südfenstern'
		]);
		expect(values(rank('fenster', locations, { today }))[0]).toBe('Ostfenster');
	});

	it('matches without umlauts and with different case', () => {
		expect(values(rank('SUDF', locations, { today }))[0]).toBe('Südfenster');
		expect(values(rank('suedf', locations, { today }))[0]).toBe('Südfenster');
	});

	it('tolerates small typos', () => {
		const genera = [
			{ value: 'Phalaenopsis', count: 2 },
			{ value: 'Paphiopedilum', count: 1 }
		];
		expect(values(rank('Phalenopsis', genera, { today }))).toEqual(['Phalaenopsis']);
		expect(values(rank('cattl', [{ value: 'Cattleya', count: 1 }], { today }))).toEqual([
			'Cattleya'
		]);
	});

	it('does not fuzz very short queries', () => {
		expect(rank('xs', [{ value: 'XL', count: 1 }], { today })).toEqual([]);
	});

	it('ranks by frequency and recency for an empty query', () => {
		expect(values(rank('', locations, { today }))[0]).toBe('Ostfenster');
		const recent: Candidate[] = [
			{ value: 'Old', count: 3, last: '2024-01-01' },
			{ value: 'Fresh', count: 3, last: '2026-10-20' }
		];
		expect(values(rank('', recent, { today }))).toEqual(['Fresh', 'Old']);
	});

	it('boosts values used in the current context', () => {
		const products: Candidate[] = [
			{ value: 'Obi Düngestäbchen', count: 20, last: '2026-09-13', context: 0 },
			{ value: 'Orchideendünger flüssig', count: 4, last: '2026-08-01', context: 4 }
		];
		expect(values(rank('o', products, { today }))[0]).toBe('Orchideendünger flüssig');
	});

	it('never lets usage outrank a better match tier', () => {
		const c: Candidate[] = [
			{ value: 'Rinde fein', count: 1 },
			{ value: 'grobe Rinde', count: 500, last: today, context: 500 }
		];
		expect(values(rank('rin', c, { today }))).toEqual(['Rinde fein', 'grobe Rinde']);
	});

	it('respects the limit', () => {
		const many = Array.from({ length: 20 }, (_, i) => ({ value: `Wert ${i}`, count: 1 }));
		expect(rank('wert', many, { today, limit: 5 })).toHaveLength(5);
	});
});

describe('findSimilar', () => {
	const genera = ['Phalaenopsis', 'Cattleya', 'Dendrobium', 'Vanda'];

	it('finds near-duplicates of a new value', () => {
		expect(findSimilar('Phalaenopis', genera)).toEqual(['Phalaenopsis']);
		expect(findSimilar('Catleya', genera)).toEqual(['Cattleya']);
		expect(findSimilar('dendrobium', genera)).toEqual(['Dendrobium']);
	});

	it('ignores exact matches and unrelated values', () => {
		expect(findSimilar('Vanda', genera)).toEqual([]);
		expect(findSimilar('Oncidium', genera)).toEqual([]);
	});
});

describe('nearDuplicates', () => {
	it('suggests merging the rarer spelling into the common one', () => {
		const hints = nearDuplicates([
			{ value: 'Phalaenopis', count: 2 },
			{ value: 'Phalaenopsis', count: 5 },
			{ value: 'Vanda', count: 2 }
		]);
		expect(hints).toEqual([{ from: 'Phalaenopis', to: 'Phalaenopsis', fromCount: 2, toCount: 5 }]);
	});
});
