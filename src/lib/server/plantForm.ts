import { kindOf, parseKind, storedValue } from '../fieldKinds.ts';
import { t } from '../i18n.ts';
import type { Db } from './db.ts';
import { chosenKinds } from './eventForm.ts';
import { learnKinds } from './fieldKinds.ts';
import type { PlantInput } from './plants.ts';

/**
 * The plant's fields; its ID is internal (new plants get the next free one). Kinds chosen
 * for new property names are stored right away (learnKinds).
 */
export function parsePlantForm(
	form: FormData,
	db: Db
): {
	input: Omit<PlantInput, 'id'>;
	error: string | null;
} {
	const get = (k: string) => String(form.get(k) ?? '').trim();
	const keys = form.getAll('attrKey').map((v) => String(v).trim());
	const values = form.getAll('attrValue').map((v) => String(v).trim());
	const chosen = form.getAll('attrKind').map((v) => parseKind(String(v)));
	const kinds = learnKinds(db, chosenKinds(keys.map((key, i) => ({ key, kind: chosen[i] }))));
	const input = {
		name: get('name'),
		active: form.get('active') === 'on',
		notes: get('notes'),
		attrs: keys
			.map((key, i) => ({ key, value: storedValue(values[i] ?? '', kindOf(kinds, key)) }))
			.filter((a) => a.key)
	};
	return { input, error: input.name ? null : t.plants.nameRequired };
}
