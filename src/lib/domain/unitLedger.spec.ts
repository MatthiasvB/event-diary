import { describe, expect, it } from 'vitest';
import type { CurrentValues } from './associations.ts';
import { holdings, shortfall, unitsWithin, unitTree, type UnitMove } from './unitLedger.ts';

const CUPBOARD = 1;
const CHARGER = 2;
const REMOTE = 3;

let next = 1;
const day = (date?: string) => ({ id: next++, date: date ?? null });
const bought = (quantity: number, to: number, date?: string): UnitMove => ({
	...day(date),
	quantity,
	from: null,
	to
});
const moved = (quantity: number, from: number, to: number, date?: string): UnitMove => ({
	...day(date),
	quantity,
	from,
	to
});
const usedUp = (quantity: number, from: number, date?: string): UnitMove => ({
	...day(date),
	quantity,
	from,
	to: null
});

describe('holdings', () => {
	it('counts what came in, moved and was used up', () => {
		const moves = [
			bought(16, CUPBOARD),
			moved(4, CUPBOARD, CHARGER, '2026-03-01'),
			moved(2, CHARGER, REMOTE, '2026-03-02'),
			usedUp(2, CHARGER, '2026-03-03')
		];
		expect(holdings(moves)).toEqual(
			new Map([
				[CUPBOARD, 12],
				[REMOTE, 2]
			])
		);
	});
});

describe('shortfall', () => {
	it('finds none while every holder keeps enough', () => {
		expect(shortfall([bought(4, CHARGER), moved(4, CHARGER, REMOTE, '2026-03-01')])).toBe(null);
	});

	it('finds a holder that gives more than it has', () => {
		expect(shortfall([bought(2, CHARGER), moved(3, CHARGER, REMOTE, '2026-03-01')])).toEqual({
			holder: CHARGER,
			date: '2026-03-01'
		});
	});

	it('checks a backdated move against what came later', () => {
		const moves = [
			bought(4, CHARGER, '2026-03-01'),
			moved(4, CHARGER, REMOTE, '2026-03-05'),
			usedUp(1, CHARGER, '2026-03-03')
		];
		expect(shortfall(moves)).toEqual({ holder: CHARGER, date: '2026-03-05' });
	});

	it('finds the gap a deleted purchase leaves', () => {
		const purchase = bought(4, CHARGER, '2026-03-01');
		const used = usedUp(4, CHARGER, '2026-03-05');
		expect(shortfall([purchase, used])).toBe(null);
		expect(shortfall([used])).toEqual({ holder: CHARGER, date: '2026-03-05' });
	});

	it('ignores the order of moves within a day', () => {
		const moves = [moved(2, CHARGER, REMOTE, '2026-03-01'), bought(2, CHARGER, '2026-03-01')];
		expect(shortfall(moves)).toBe(null);
	});

	it('counts moves from the start before dated ones', () => {
		expect(shortfall([moved(2, CHARGER, REMOTE, '2026-03-01'), bought(2, CHARGER)])).toBe(null);
	});
});

describe('along an association', () => {
	const current: CurrentValues = new Map([
		[CHARGER, { In: String(CUPBOARD) }],
		[REMOTE, { In: '9' }]
	]);
	const held = new Map([
		[CUPBOARD, 9],
		[CHARGER, 4],
		[REMOTE, 3]
	]);

	it('nests holders under the objects they are in', () => {
		expect(unitTree(held, 'In', current)).toEqual([
			{
				id: CUPBOARD,
				own: 9,
				total: 13,
				children: [{ id: CHARGER, own: 4, total: 4, children: [] }]
			},
			{ id: 9, own: 0, total: 3, children: [{ id: REMOTE, own: 3, total: 3, children: [] }] }
		]);
	});

	it('counts what an object holds itself and what is in it', () => {
		expect(unitsWithin(CUPBOARD, held, 'In', current)).toEqual({ own: 9, total: 13 });
		expect(unitsWithin(9, held, 'In', current)).toEqual({ own: 0, total: 3 });
		expect(unitsWithin(CHARGER, held, 'In', current)).toEqual({ own: 4, total: 4 });
	});
});
