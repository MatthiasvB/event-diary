export const OBJECT_ORDERS = ['name', 'recent'] as const;
export type ObjectOrder = (typeof OBJECT_ORDERS)[number];

type Sortable = { name: string; stats: { last: { date: string } | null } };

const byName = (a: Sortable, b: Sortable) => a.name.localeCompare(b.name, 'de');

/** Most recently active: by the date of the latest event, objects without events last. */
export function sortObjects<T extends Sortable>(objects: T[], order: ObjectOrder): T[] {
	if (order === 'name') return objects.toSorted(byName);
	return objects.toSorted(
		(a, b) => (b.stats.last?.date ?? '').localeCompare(a.stats.last?.date ?? '') || byName(a, b)
	);
}
