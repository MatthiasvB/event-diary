import type { StockOption } from '../unitMoves.ts';
import type { Db } from './db.ts';
import { listObjects } from './objects.ts';
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
						along: o.stock.along,
						holders: [...(held.get(o.id) ?? [])]
							.map(([id, count]) => ({ id, count }))
							.sort((a, b) => b.count - a.count)
					}
				]
			: []
	);
}
