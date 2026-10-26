import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/diary.ts';
import { rename, vocabulary, type ValueKind } from '#lib/server/vocab.ts';
import { nearDuplicates, type Candidate } from '#lib/suggest.ts';
import { t } from '#lib/i18n.ts';
import type { Actions, PageServerLoad } from './$types';

type Kind = ValueKind['kind'];
const KINDS: Kind[] = ['category', 'type', 'key', 'value'];

function parseKind(kind: string | null, key: string | null): ValueKind | null {
	if (!KINDS.includes(kind as Kind)) return null;
	if (kind === 'value') return key ? { kind, key } : null;
	return { kind: kind as Exclude<Kind, 'value'> };
}

function merged(lists: Candidate[][]): Candidate[] {
	const map = new Map<string, Candidate>();
	for (const c of lists.flat()) {
		const m = map.get(c.value);
		map.set(c.value, m ? { ...m, count: m.count + c.count } : { value: c.value, count: c.count });
	}
	return [...map.values()];
}

export const load: PageServerLoad = ({ url }) => {
	const vocab = vocabulary(db());
	const allKeys = merged([vocab.keys.event, vocab.keys.plant]).sort((a, b) =>
		a.value.localeCompare(b.value, 'de')
	);
	const kindParam = url.searchParams.get('kind') ?? 'value';
	const key = url.searchParams.get('key') ?? allKeys[0]?.value ?? null;
	const kind = parseKind(kindParam, key);

	let candidates: Candidate[] = [];
	if (kind?.kind === 'category') candidates = vocab.categories;
	else if (kind?.kind === 'type')
		// One entry per name; renaming applies in every category that has it.
		candidates = merged([vocab.types.map((ty) => ({ value: ty.name, count: ty.count }))]);
	else if (kind?.kind === 'key') candidates = allKeys;
	else if (kind?.kind === 'value')
		candidates = (vocab.values[kind.key] ?? []).map(({ value, count }) => ({ value, count }));
	candidates.sort((a, b) => a.value.localeCompare(b.value, 'de'));

	return {
		kind: kindParam,
		key,
		keys: allKeys.map((k) => k.value),
		candidates,
		duplicates: nearDuplicates(candidates)
	};
};

export const actions: Actions = {
	rename: async ({ request }) => {
		const form = await request.formData();
		const what = parseKind(String(form.get('kind')), String(form.get('key') ?? ''));
		const from = String(form.get('from') ?? '');
		const to = String(form.get('to') ?? '').trim();
		if (!what || !from || !to) return fail(400);
		return { message: t.maintenance.done(rename(db(), what, from, to)) };
	}
};
