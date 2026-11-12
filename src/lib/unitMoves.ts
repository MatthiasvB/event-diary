import { formatTarget, parseTarget } from './domain/associations.ts';
import type { MoveRow, Place } from './domain/unitLedger.ts';
import type { EventObject, EventUnitMove } from './types.ts';

export type StockOption = {
	id: number;
	name: string;
	/** Where its units are: those not assigned first, then the largest count first. */
	places: { place: Place; count: number }[];
};

export const itemRow = (id: number) => ({ item: formatTarget({ id }) });

export function rowOf(m: EventUnitMove): MoveRow {
	const item = (o: EventObject | null) => o && itemRow(o.id);
	return {
		stock: m.stock.id,
		quantity: m.quantity,
		from: m.kind === 'add' ? 'new' : (m.from?.id ?? null),
		to: m.kind === 'remove' ? 'gone' : item(m.to)
	};
}

function placeOf(to: MoveRow['to']): Place | undefined {
	if (to === null) return null;
	const target = to === 'gone' ? null : parseTarget(to.item);
	return target && 'id' in target ? target.id : undefined;
}

/**
 * A new row for `stock` (or the first). Without `from`, the units come from the first of its
 * places other than where they go, or are new.
 */
export function newRow(
	stocks: StockOption[],
	preset: { stock?: number; from?: MoveRow['from']; to: MoveRow['to'] }
): MoveRow {
	const stock = stocks.find((s) => s.id === preset.stock) ?? stocks[0];
	const to = placeOf(preset.to);
	const source = stock?.places.find((p) => p.place !== to)?.place;
	return {
		stock: stock?.id ?? null,
		quantity: 1,
		from: preset.from ?? (source === undefined ? 'new' : source),
		to: preset.to
	};
}
