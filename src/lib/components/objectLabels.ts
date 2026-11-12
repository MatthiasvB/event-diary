/** Each object's name, numbered where several share one, so a label picks one object. */
export function distinctLabels(names: Record<number, string>): Map<number, string> {
	const labels = new Map<number, string>();
	const taken = new Set(Object.values(names));
	const seen = new Map<string, number>();
	for (const [id, name] of Object.entries(names).sort(([a], [b]) => Number(a) - Number(b))) {
		let n = (seen.get(name) ?? 0) + 1;
		let label = name;
		if (n > 1) {
			while (taken.has(`${name} (${n})`)) n++;
			label = `${name} (${n})`;
			taken.add(label);
		}
		seen.set(name, n);
		labels.set(Number(id), label);
	}
	return labels;
}
