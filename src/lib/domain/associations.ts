/** What an association's input holds: an object that exists, or the name of one to create. */
export type Target = { id: number } | { name: string };

const NEW = '+';

export const formatTarget = (target: Target) =>
	'id' in target ? String(target.id) : NEW + target.name;

export function parseTarget(value: string): Target | null {
	if (value.startsWith(NEW)) {
		const name = value.slice(NEW.length).trim();
		return name ? { name } : null;
	}
	return /^[1-9]\d*$/.test(value) ? { id: Number(value) } : null;
}

export function targetName(
	value: string,
	nameOf: (id: number) => string | undefined
): string | undefined {
	const target = parseTarget(value);
	if (!target) return undefined;
	return 'id' in target ? nameOf(target.id) : target.name;
}

/** Each object's current values by name. */
export type CurrentValues = Map<number, Record<string, string>>;

function targetOf(id: number, key: string, current: CurrentValues): number | null {
	const target = parseTarget(current.get(id)?.[key] ?? '');
	return target && 'id' in target ? target.id : null;
}

/** The objects reached by following `key` from `id`, nearest first. */
export function pathOf(id: number, key: string, current: CurrentValues): number[] {
	const path: number[] = [];
	for (
		let next = targetOf(id, key, current);
		next !== null && next !== id && !path.includes(next);
		next = targetOf(next, key, current)
	) {
		path.push(next);
	}
	return path;
}

/** For each of `keys` that has any, the objects whose current value is `id`. */
export function pointingTo(
	id: number,
	keys: string[],
	current: CurrentValues
): { key: string; ids: number[] }[] {
	return keys.flatMap((key) => {
		const ids = [...current.keys()].filter((other) => targetOf(other, key, current) === id);
		return ids.length ? [{ key, ids }] : [];
	});
}
