import type { Db } from './db.ts';
import { listObjects } from './objects.ts';

export function objectOptions(db: Db) {
	return listObjects(db).map(({ id, name, active, attrs }) => ({ id, name, active, attrs }));
}
