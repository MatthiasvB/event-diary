// Typeahead matching and ranking, shared by the browser (comboboxes) and the server
// (near-duplicate detection in data maintenance).

export type Candidate = {
	value: string;
	/** How often the value is used overall. */
	count: number;
	/** Last date it was used, YYYY-MM-DD. */
	last?: string | null;
	/** How often it is used in the current context, e.g. with the chosen event type. */
	context?: number;
	/** Shown next to the value, e.g. what kind of name it is; `accent` stands out. */
	tag?: { text: string; accent?: boolean };
};

export type MatchKind = 'exact' | 'prefix' | 'word' | 'substring' | 'fuzzy' | 'none';

export type Suggestion = Candidate & { score: number; match: MatchKind };

/** Case-, umlaut- and whitespace-insensitive form: "Düngen" ≈ "duengen" ≈ "DUNGEN". */
export function normalize(s: string): string {
	return s
		.toLowerCase()
		.replace(/ß/g, 'ss')
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/ae/g, 'a')
		.replace(/oe/g, 'o')
		.replace(/ue/g, 'u')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Optimal string alignment distance (Levenshtein plus transpositions). */
export function distance(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;
	let prev2: number[] = [];
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
			}
		}
		prev2 = prev;
		prev = cur;
	}
	return prev[b.length];
}

/** Typos tolerated for a term of this length. */
function allowedTypos(length: number): number {
	return length <= 3 ? 0 : length <= 7 ? 1 : 2;
}

const TIERS: Record<MatchKind, number> = {
	exact: 1000,
	prefix: 800,
	word: 600,
	substring: 400,
	fuzzy: 200,
	none: 0
};

function matchKind(query: string, value: string): { kind: MatchKind; typos: number } | null {
	if (!query) return { kind: 'none', typos: 0 };
	if (value === query) return { kind: 'exact', typos: 0 };
	if (value.startsWith(query)) return { kind: 'prefix', typos: 0 };
	const words = value.split(/[\s\-/+,.()'"]+/).filter(Boolean);
	if (words.some((w) => w.startsWith(query))) return { kind: 'word', typos: 0 };
	if (value.includes(query)) return { kind: 'substring', typos: 0 };

	const allowed = allowedTypos(query.length);
	if (!allowed) return null;
	let best = Infinity;
	for (const part of [value, ...words]) {
		// Compare against the whole part and against its beginning (the user is still typing).
		best = Math.min(best, distance(query, part), distance(query, part.slice(0, query.length)));
	}
	return best <= allowed ? { kind: 'fuzzy', typos: best } : null;
}

function daysBetween(from: string, to: string): number {
	return Math.max(0, (Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** Usage bonus; capped so that it reorders within a match tier but never across tiers. */
function usageScore(c: Candidate, today: string): number {
	const frequency = Math.log2(1 + c.count) * 20;
	const recency = c.last ? 40 * Math.exp(-daysBetween(c.last, today) / 120) : 0;
	const context = Math.log2(1 + (c.context ?? 0)) * 50;
	return Math.min(190, frequency + recency + context);
}

export function rank(
	query: string,
	candidates: Candidate[],
	options: { limit?: number; today?: string } = {}
): Suggestion[] {
	const q = normalize(query);
	const today = options.today ?? new Date().toISOString().slice(0, 10);
	const results: Suggestion[] = [];
	for (const c of candidates) {
		const m = matchKind(q, normalize(c.value));
		if (!m) continue;
		const score = TIERS[m.kind] - m.typos * 50 + usageScore(c, today);
		results.push({ ...c, score, match: m.kind });
	}
	results.sort((a, b) => b.score - a.score || a.value.localeCompare(b.value, 'de'));
	return results.slice(0, options.limit ?? 8);
}

/**
 * Existing values that look like a variant of `input` (case, umlauts, small typos),
 * excluding an exact match. Used to warn before a near-duplicate is created.
 */
export function findSimilar(input: string, values: string[]): string[] {
	const n = normalize(input);
	if (!n) return [];
	return values
		.filter((v) => v !== input)
		.map((v) => ({ v, d: distance(n, normalize(v)) }))
		.filter(({ d }) => d <= allowedTypos(n.length))
		.sort((a, b) => a.d - b.d)
		.map(({ v }) => v);
}

export type DuplicateHint = { from: string; to: string; fromCount: number; toCount: number };

/** Pairs of values that are probably the same thing; suggests merging the rarer one. */
export function nearDuplicates(candidates: Candidate[]): DuplicateHint[] {
	const hints: DuplicateHint[] = [];
	for (let i = 0; i < candidates.length; i++) {
		for (let j = i + 1; j < candidates.length; j++) {
			const a = candidates[i];
			const b = candidates[j];
			if (!findSimilar(a.value, [b.value]).length) continue;
			const [from, to] = a.count > b.count ? [b, a] : [a, b];
			hints.push({ from: from.value, to: to.value, fromCount: from.count, toCount: to.count });
		}
	}
	return hints;
}
