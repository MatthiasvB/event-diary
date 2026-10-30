import type { PropertyValue, Replaced } from '../types.ts';

type Position = { since: string; id: number };

/** Where a change on `date` that is not saved yet goes: after every value of that day. */
export const unsaved = (date: string): Position => ({ since: date, id: Infinity });

const positionOf = (v: PropertyValue): Position => ({ since: v.since ?? '', id: v.id });
const isBefore = (a: Position, b: Position) =>
	a.since < b.since || (a.since === b.since && a.id < b.id);

/** The value a change at `at` replaces. Values set by `ownEvent` don't count. */
export function replaced(history: PropertyValue[], at: Position, ownEvent?: number): Replaced {
	let latest: PropertyValue | undefined;
	for (const v of history) {
		if (ownEvent !== undefined && v.eventId === ownEvent) continue;
		if (!isBefore(positionOf(v), at)) continue;
		if (!latest || isBefore(positionOf(latest), positionOf(v))) latest = v;
	}
	return latest ? { value: latest.value, initial: latest.since === null } : null;
}

/** Only a property's first change can set the value before it. */
export const isFirstChange = (r: Replaced) => r === null || r.initial;
