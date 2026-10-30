import { kindOf, parseKind, storedValue } from '../fieldKinds.ts';
import type { EventType, FieldTemplate } from '../types.ts';
import type { Db } from './db.ts';
import { chosenKinds } from './eventForm.ts';
import { learnKinds, propertyKeys } from './fields.ts';

export function parseTypeForm(form: FormData, db: Db): Omit<EventType, 'id' | 'name'> {
	const keys = form.getAll('fieldKey').map((v) => String(v).trim());
	const values = form.getAll('fieldValue').map((v) => String(v).trim());
	const targets = form.getAll('fieldTarget').map(String);
	const chosen = form.getAll('fieldKind').map((v) => parseKind(String(v)));
	// Kinds chosen for new names are stored first, so defaults are stored in their form.
	const kinds = learnKinds(
		db,
		chosenKinds(keys.map((key, i) => ({ key, kind: chosen[i], target: targets[i] })))
	);
	const properties = propertyKeys(db);
	const fields: FieldTemplate[] = keys
		.map((key, i) => ({
			key,
			target:
				properties.has(key) || targets[i] === 'object' ? ('object' as const) : ('event' as const),
			...(values[i] ? { default: storedValue(values[i], kindOf(kinds, key)) } : {})
		}))
		.filter((f) => f.key);
	return {
		category: String(form.get('category') ?? '').trim() || null,
		milestone: form.get('milestone') === 'on',
		hint: String(form.get('hint') ?? '').trim(),
		fields
	};
}
