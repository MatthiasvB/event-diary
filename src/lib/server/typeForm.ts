import { kindOf, storedValue } from '../fieldKinds.ts';
import type { EventType, FieldTemplate } from '../types.ts';
import type { Db } from './db.ts';
import { chosenNames } from './eventForm.ts';
import { learnChoices, propertyKeys } from './fields.ts';

export function parseTypeForm(form: FormData, db: Db): Omit<EventType, 'id' | 'name'> {
	const keys = form.getAll('fieldKey').map((v) => String(v).trim());
	const values = form.getAll('fieldValue').map((v) => String(v).trim());
	const targets = form.getAll('fieldTarget').map(String);
	const chosen = form.getAll('fieldChoice').map(String);
	// What is chosen for new names is stored first, so defaults are stored in their kind.
	const kinds = learnChoices(
		db,
		chosenNames(keys.map((key, i) => ({ key, chosen: chosen[i], target: targets[i] })))
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
