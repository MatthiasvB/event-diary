import { t } from '../i18n.ts';
import { normalize } from '../suggest.ts';
import type { Db } from './db.ts';

export function getSetting<T>(db: Db, key: string): T | undefined {
	const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
		{ value: string } | undefined;
	return row && (JSON.parse(row.value) as T);
}

export function setSetting(db: Db, key: string, value: unknown) {
	db.prepare(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	).run(key, JSON.stringify(value));
}

export type OverviewColumn = { label: string; typeIds: number[] };

const OVERVIEW = 'overviewColumns';

/**
 * Event types shown as "last …" columns in the plant overview. Until the user chooses,
 * the default set is matched by name against the existing types.
 */
export function getOverviewColumns(db: Db): OverviewColumn[] {
	const stored = getSetting<OverviewColumn[]>(db, OVERVIEW);
	if (stored) return stored;
	const types = db.prepare('SELECT id, name FROM event_types').all() as {
		id: number;
		name: string;
	}[];
	// A name may exist in several categories; the column then covers all of them.
	return t.defaultOverviewColumns
		.map((c) => ({
			label: c.label,
			typeIds: types
				.filter((ty) => c.types.some((n) => normalize(n) === normalize(ty.name)))
				.map((ty) => ty.id)
		}))
		.filter((c) => c.typeIds.length);
}

export function setOverviewColumns(db: Db, columns: OverviewColumn[]) {
	setSetting(db, OVERVIEW, columns);
}
