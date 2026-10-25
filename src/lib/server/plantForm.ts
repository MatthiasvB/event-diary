import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import type { PlantInput } from './plants.ts';

/** The plant's fields; its ID is internal (new plants get the next free one). */
export function parsePlantForm(form: FormData): {
	input: Omit<PlantInput, 'id'>;
	error: string | null;
} {
	const get = (k: string) => String(form.get(k) ?? '').trim();
	const keys = form.getAll('attrKey').map((v) => String(v).trim());
	const values = form.getAll('attrValue').map((v) => String(v).trim());
	const acquiredOn = get('acquiredOn');
	const input = {
		name: get('name'),
		active: form.get('active') === 'on',
		acquiredOn: isValidDate(acquiredOn) ? acquiredOn : null,
		notes: get('notes'),
		attrs: keys.map((key, i) => ({ key, value: values[i] ?? '' })).filter((a) => a.key)
	};
	return { input, error: input.name ? null : t.plants.nameRequired };
}
