import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import { PLANT_ID_PATTERN, type PlantInput } from './plants.ts';

export function parsePlantForm(form: FormData): { input: PlantInput; error: string | null } {
	const get = (k: string) => String(form.get(k) ?? '').trim();
	const keys = form.getAll('attrKey').map((v) => String(v).trim());
	const values = form.getAll('attrValue').map((v) => String(v).trim());
	const acquiredOn = get('acquiredOn');
	const input: PlantInput = {
		id: get('id'),
		name: get('name'),
		active: form.get('active') === 'on',
		acquiredOn: isValidDate(acquiredOn) ? acquiredOn : null,
		notes: get('notes'),
		attrs: keys.map((key, i) => ({ key, value: values[i] ?? '' })).filter((a) => a.key)
	};
	let error: string | null = null;
	if (!PLANT_ID_PATTERN.test(input.id)) error = t.plants.idInvalid;
	else if (!input.name) error = t.plants.nameRequired;
	return { input, error };
}
