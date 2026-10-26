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

const PROPERTY_ORDER = 'propertyOrder';

/** Property names in the order objects show them, as arranged in the settings. */
export function getPropertyOrder(db: Db): string[] {
	return getSetting<string[]>(db, PROPERTY_ORDER) ?? [];
}

export function setPropertyOrder(db: Db, keys: string[]) {
	setSetting(db, PROPERTY_ORDER, [...new Set(keys.filter(Boolean))]);
}

/** Sorts property names: arranged ones in their order, the others after them, alphabetically. */
export function sortProperties(db: Db, keys: string[]): string[] {
	const order = getPropertyOrder(db);
	const rank = (key: string) => {
		const i = order.indexOf(key);
		return i < 0 ? order.length : i;
	};
	return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'de'));
}
