import { pathOf, type CurrentValues } from './associations.ts';

/** An object holding units, or `null` for units of the stock not assigned to any. */
export type Place = number | null;

/** New units are added, used ones removed. A `null` end is units not assigned to an object. */
export type Kinded<F, T = F> =
	| { kind: 'add'; to: T | null }
	| { kind: 'remove'; from: F | null }
	| { kind: 'move'; from: F | null; to: T | null };

/** Undated moves come first. */
export type UnitMove = { id: number; quantity: number; date: string | null } & Kinded<number>;

/** As a form enters a move: `to` holds an association's input (an id, or a name to create). */
export type MoveDraft = { stockId: number; quantity: number } & Kinded<number, string>;

/** What a form holds while a move is entered. */
export type MoveRow = {
	stock: number | null;
	quantity: number;
	from: 'new' | Place;
	to: 'gone' | { item: string } | null;
};

const positive = (v: unknown) => (Number.isInteger(v) && Number(v) > 0 ? Number(v) : null);

function fromOf(v: unknown): 'new' | Place | undefined {
	if (v === 'new' || v === null) return v;
	return positive(v) ?? undefined;
}

function toOf(v: unknown): 'gone' | string | null | undefined {
	if (v === 'gone' || v === null) return v;
	const item = (v as { item?: unknown } | undefined)?.item;
	return typeof item === 'string' && item.trim() ? item.trim() : undefined;
}

/** A move as a form sends it, in the shape of a `MoveRow`. */
export function parseMove(raw: unknown): MoveDraft | null {
	const r = (raw ?? {}) as Record<string, unknown>;
	const stockId = positive(r.stock);
	const quantity = positive(r.quantity);
	const from = fromOf(r.from);
	const to = toOf(r.to);
	if (stockId === null || quantity === null || from === undefined || to === undefined) return null;
	const base = { stockId, quantity };
	if (from === 'new') return to === 'gone' ? null : { ...base, kind: 'add', to };
	if (to === 'gone') return { ...base, kind: 'remove', from };
	return from === null && to === null ? null : { ...base, kind: 'move', from, to };
}

/** The days in order, each with its moves. */
function days(moves: UnitMove[]): UnitMove[][] {
	const byDay = Map.groupBy(moves, (m) => m.date ?? '');
	return [...byDay.keys()].sort().map((day) => byDay.get(day) ?? []);
}

function apply(held: Map<Place, number>, m: UnitMove) {
	const change = (place: Place, by: number) => held.set(place, (held.get(place) ?? 0) + by);
	if (m.kind !== 'add') change(m.from, -m.quantity);
	if (m.kind !== 'remove') change(m.to, m.quantity);
}

/** How many units each place holds after all moves. Places holding none are left out. */
export function holdings(moves: UnitMove[]): Map<Place, number> {
	const held = new Map<Place, number>();
	for (const m of moves) apply(held, m);
	return new Map([...held].filter(([, n]) => n !== 0));
}

/**
 * The first place to hold fewer than none at the end of a day. Within a day the order of
 * moves doesn't matter.
 */
export function shortfall(moves: UnitMove[]): { place: Place; date: string | null } | null {
	const held = new Map<Place, number>();
	for (const day of days(moves)) {
		for (const m of day) apply(held, m);
		const short = [...held].find(([, n]) => n < 0);
		if (short) return { place: short[0], date: day[0].date };
	}
	return null;
}

/** The units `id` holds itself, and those including what is in it along any of `keys`. */
export function unitsInside(
	id: number,
	held: Map<Place, number>,
	keys: string[],
	current: CurrentValues
): { own: number; total: number } {
	let total = 0;
	for (const [place, count] of held) {
		if (place === null) continue;
		if (place === id || keys.some((key) => pathOf(place, key, current).includes(id))) {
			total += count;
		}
	}
	return { own: held.get(id) ?? 0, total };
}
