import { formatTarget } from './domain/associations.ts';
import type { EventUnitMove } from './types.ts';

/** A move as a form holds it: `from` null is new units, `to` null is used up. */
export type MoveRow = {
	stock: number | null;
	quantity: number;
	from: number | null;
	to: string | null;
};

export type StockOption = {
	id: number;
	name: string;
	along: string;
	/** Largest first. */
	holders: { id: number; count: number }[];
};

export const rowOf = (m: EventUnitMove): MoveRow => ({
	stock: m.stock.id,
	quantity: m.quantity,
	from: m.from?.id ?? null,
	to: m.to && formatTarget({ id: m.to.id })
});

/** A new row: units of `stock` (or the first), from its largest holder other than `to`. */
export function newRow(stocks: StockOption[], fixed: { stock?: number; to?: number }): MoveRow {
	const stock = stocks.find((s) => s.id === fixed.stock) ?? stocks[0];
	return {
		stock: stock?.id ?? null,
		quantity: 1,
		from: stock?.holders.find((h) => h.id !== fixed.to)?.id ?? null,
		to: fixed.to === undefined ? '' : formatTarget({ id: fixed.to })
	};
}
