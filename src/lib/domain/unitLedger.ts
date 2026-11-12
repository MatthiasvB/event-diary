import { pathOf, type CurrentValues } from './associations.ts';

/** A move from nowhere adds units, one to nowhere uses them up. */
export type Sides<F, T = F> = { from: F; to: T | null } | { from: null; to: T };

export function sidesOf<F, T>(from: F | null, to: T | null): Sides<F, T> | null {
	if (from !== null) return { from, to };
	return to === null ? null : { from: null, to };
}

/** Undated moves come first. */
export type UnitMove = { id: number; quantity: number; date: string | null } & Sides<number>;

/** The days in order, each with its moves. */
function days(moves: UnitMove[]): UnitMove[][] {
	const byDay = Map.groupBy(moves, (m) => m.date ?? '');
	return [...byDay.keys()].sort().map((day) => byDay.get(day) ?? []);
}

function apply(held: Map<number, number>, m: UnitMove) {
	if (m.from !== null) held.set(m.from, (held.get(m.from) ?? 0) - m.quantity);
	if (m.to !== null) held.set(m.to, (held.get(m.to) ?? 0) + m.quantity);
}

/** How many units each object holds after all moves. Objects holding none are left out. */
export function holdings(moves: UnitMove[]): Map<number, number> {
	const held = new Map<number, number>();
	for (const m of moves) apply(held, m);
	return new Map([...held].filter(([, n]) => n !== 0));
}

/**
 * The first object to hold fewer than none at the end of a day. Within a day the order of
 * moves doesn't matter.
 */
export function shortfall(moves: UnitMove[]): { holder: number; date: string | null } | null {
	const held = new Map<number, number>();
	for (const day of days(moves)) {
		for (const m of day) apply(held, m);
		const short = [...held].find(([, n]) => n < 0);
		if (short) return { holder: short[0], date: day[0].date };
	}
	return null;
}

export type UnitNode = { id: number; own: number; total: number; children: UnitNode[] };

/** The holders, nested along `key` under the objects they are in, largest first. */
export function unitTree(held: Map<number, number>, key: string, current: CurrentValues) {
	type Draft = { own: number; children: Map<number, Draft> };
	const roots = new Map<number, Draft>();
	for (const [holder, count] of held) {
		let level = roots;
		let node: Draft | undefined;
		for (const id of [...pathOf(holder, key, current)].reverse().concat(holder)) {
			node = level.get(id) ?? { own: 0, children: new Map() };
			level.set(id, node);
			level = node.children;
		}
		if (node) node.own += count;
	}
	const finish = (level: Map<number, Draft>): UnitNode[] =>
		[...level]
			.map(([id, d]) => {
				const children = finish(d.children);
				return {
					id,
					own: d.own,
					total: d.own + children.reduce((n, c) => n + c.total, 0),
					children
				};
			})
			.sort((a, b) => b.total - a.total || a.id - b.id);
	return finish(roots);
}

/** The units `id` holds itself, and those including what is in it along `key`. */
export function unitsWithin(
	id: number,
	held: Map<number, number>,
	key: string,
	current: CurrentValues
): { own: number; total: number } {
	let total = 0;
	for (const [holder, count] of held) {
		if (holder === id || pathOf(holder, key, current).includes(id)) total += count;
	}
	return { own: held.get(id) ?? 0, total };
}
