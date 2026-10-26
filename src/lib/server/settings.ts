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

/** Event types shown as "last …" columns in the overview, as chosen in the settings. */
export function getOverviewColumns(db: Db): OverviewColumn[] {
	return getSetting<OverviewColumn[]>(db, OVERVIEW) ?? [];
}

export function setOverviewColumns(db: Db, columns: OverviewColumn[]) {
	setSetting(db, OVERVIEW, columns);
}
