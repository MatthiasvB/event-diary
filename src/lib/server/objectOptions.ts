import type { Db } from './db.ts';
import { listObjects } from './objects.ts';

/** Objects as offered in pickers and filters. */
export function objectOptions(db: Db) {
	return listObjects(db).map(({ id, name, active, attrs }) => ({ id, name, active, attrs }));
}
