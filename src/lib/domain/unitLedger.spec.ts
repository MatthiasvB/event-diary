import { describe, expect, it } from 'vitest';
import type { CurrentValues } from './associations.ts';
import {
	holdings,
	parseMove,
	shortfall,
	unitsInside,
	type Place,
	type UnitMove
} from './unitLedger.ts';

const CUPBOARD = 1;
const CHARGER = 2;
const REMOTE = 3;
const CAR = 4;

let next = 1;
const day = (date?: string) => ({ id: next++, date: date ?? null });
const bought = (quantity: number, to: Place, date?: string): UnitMove => ({
	...day(date),
	quantity,
	kind: 'add',
	to
});
const moved = (quantity: number, from: Place, to: Place, date?: string): UnitMove => ({
	...day(date),
	quantity,
	kind: 'move',
	from,
	to
});
const usedUp = (quantity: number, from: Place, date?: string): UnitMove => ({
	...day(date),
	quantity,
	kind: 'remove',
	from
});

describe('holdings', () => {
	it('counts what came in, was assigned, moved and used up', () => {
		const moves = [
			bought(16, null),
			moved(4, null, CHARGER, '2026-03-01'),
			moved(2, CHARGER, REMOTE, '2026-03-02'),
			usedUp(2, CHARGER, '2026-03-03'),
			moved(1, REMOTE, null, '2026-03-04')
		];
		expect(holdings(moves)).toEqual(
			new Map([
				[null, 13],
				[REMOTE, 1]
			])
		);
	});
});

describe('shortfall', () => {
	it('finds none while every place keeps enough', () => {
		expect(shortfall([bought(4, null), moved(4, null, REMOTE, '2026-03-01')])).toBe(null);
	});

	it('finds an object that gives more than it has', () => {
		expect(shortfall([bought(2, CHARGER), moved(3, CHARGER, REMOTE, '2026-03-01')])).toEqual({
			place: CHARGER,
			date: '2026-03-01'
		});
	});

	it('finds more assigned or used up than the stock has', () => {
		expect(shortfall([bought(2, null), usedUp(3, null, '2026-03-01')])).toEqual({
			place: null,
			date: '2026-03-01'
		});
	});

	it('checks a backdated move against what came later', () => {
		const moves = [
			bought(4, CHARGER, '2026-03-01'),
			moved(4, CHARGER, REMOTE, '2026-03-05'),
			usedUp(1, CHARGER, '2026-03-03')
		];
		expect(shortfall(moves)).toEqual({ place: CHARGER, date: '2026-03-05' });
	});

	it('ignores the order of moves within a day', () => {
		const moves = [moved(2, CHARGER, REMOTE, '2026-03-01'), bought(2, CHARGER, '2026-03-01')];
		expect(shortfall(moves)).toBe(null);
	});

	it('counts moves from the start before dated ones', () => {
		expect(shortfall([moved(2, null, REMOTE, '2026-03-01'), bought(2, null)])).toBe(null);
	});
});

describe('parseMove', () => {
	const row = { stock: 7, quantity: 2 };

	it('tells additions, removals and moves apart', () => {
		expect(parseMove({ ...row, from: 'new', to: null })).toEqual({
			stockId: 7,
			quantity: 2,
			kind: 'add',
			to: null
		});
		expect(parseMove({ ...row, from: 3, to: 'gone' })).toEqual({
			stockId: 7,
			quantity: 2,
			kind: 'remove',
			from: 3
		});
		expect(parseMove({ ...row, from: null, to: { item: '+Kiste' } })).toEqual({
			stockId: 7,
			quantity: 2,
			kind: 'move',
			from: null,
			to: '+Kiste'
		});
	});

	it('refuses what is no move', () => {
		expect(parseMove({ ...row, from: 'new', to: 'gone' })).toBe(null);
		expect(parseMove({ ...row, from: null, to: null })).toBe(null);
		expect(parseMove({ ...row, from: 3, to: { item: '' } })).toBe(null);
		expect(parseMove({ ...row, quantity: 0, from: 3, to: null })).toBe(null);
		expect(parseMove(null)).toBe(null);
	});
});

describe('unitsInside', () => {
	const current: CurrentValues = new Map<number, Record<string, string>>([
		[CHARGER, { In: String(CUPBOARD) }],
		[REMOTE, { In: String(CAR), Bei: String(CUPBOARD) }]
	]);
	const held = new Map<Place, number>([
		[null, 5],
		[CUPBOARD, 9],
		[CHARGER, 4],
		[REMOTE, 3]
	]);

	it('counts what an object holds itself and what is in it, along any association', () => {
		expect(unitsInside(CUPBOARD, held, ['In', 'Bei'], current)).toEqual({ own: 9, total: 16 });
		expect(unitsInside(CAR, held, ['In', 'Bei'], current)).toEqual({ own: 0, total: 3 });
		expect(unitsInside(CHARGER, held, ['In', 'Bei'], current)).toEqual({ own: 4, total: 4 });
	});
});
