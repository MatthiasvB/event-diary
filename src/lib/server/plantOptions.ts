import type { Db } from './db.ts';
import { listPlants } from './plants.ts';

/** Plants as offered in pickers and filters. */
export function plantOptions(db: Db) {
	return listPlants(db).map(({ id, name, active, attrs }) => ({ id, name, active, attrs }));
}
