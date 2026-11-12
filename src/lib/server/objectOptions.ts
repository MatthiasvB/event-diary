import { unitsInside } from '../domain/unitLedger.ts';
import type { StockOption } from '../unitMoves.ts';
import type { Db } from './db.ts';
import { associationKeys } from './fields.ts';
import { currentAttrs, listObjects } from './objects.ts';
import { allHoldings } from './units.ts';

export function objectOptions(db: Db) {
	return listObjects(db).map(({ id, name, active, attrs }) => ({ id, name, active, attrs }));
}

export function stockOptions(db: Db): StockOption[] {
	const held = allHoldings(db);
	return listObjects(db).flatMap((o) =>
		o.stock
			? [
					{
						id: o.id,
						name: o.name,
						places: [...(held.get(o.id) ?? [])]
							.map(([place, count]) => ({ place, count }))
							.sort(
								(a, b) => Number(a.place !== null) - Number(b.place !== null) || b.count - a.count
							)
					}
				]
			: []
	);
}

/** The units of each stock the item holds, itself and through the objects in it. */
export function unitsHeldBy(db: Db, id: number) {
	const held = allHoldings(db);
	const keys = associationKeys(db);
	const current = currentAttrs(db);
	return stockOptions(db).flatMap((s) => {
		const inside = unitsInside(id, held.get(s.id) ?? new Map(), keys, current);
		return inside.total ? [{ stock: { id: s.id, name: s.name }, ...inside }] : [];
	});
}
