import { kindOf, parseKind, storedValue } from '../fieldKinds.ts';
import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import type { Db } from './db.ts';
import { chosenKinds } from './eventForm.ts';
import { createEvents } from './events.ts';
import { photoType } from './eventTypes.ts';
import { learnKinds } from './fields.ts';
import { FILE_ID, filesExist } from './files.ts';
import { createObject, type ObjectInput } from './objects.ts';

/** Stores kinds chosen for new property names right away. */
export function parseObjectForm(
	form: FormData,
	db: Db
): {
	input: Omit<ObjectInput, 'id'>;
	error: string | null;
} {
	const get = (k: string) => String(form.get(k) ?? '').trim();
	const keys = form.getAll('attrKey').map((v) => String(v).trim());
	const values = form.getAll('attrValue').map((v) => String(v).trim());
	const chosen = form.getAll('attrKind').map((v) => parseKind(String(v)));
	const kinds = learnKinds(
		db,
		chosenKinds(keys.map((key, i) => ({ key, kind: chosen[i], target: 'object' })))
	);
	const input = {
		name: get('name'),
		active: form.get('active') === 'on',
		notes: get('notes'),
		attrs: keys
			.map((key, i) => ({ key, value: storedValue(values[i] ?? '', kindOf(kinds, key)) }))
			.filter((a) => a.key)
	};
	return { input, error: input.name ? null : t.objects.nameRequired };
}

/** Photos sent along become a photo event, on their capture date if known. */
export function saveNewObject(
	form: FormData,
	db: Db,
	today: string
): { id: number } | { error: string } {
	const { input, error } = parseObjectForm(form, db);
	if (error) return { error };
	const fileIds = form
		.getAll('file')
		.map(String)
		.filter((id) => FILE_ID.test(id));
	if (!filesExist(db, fileIds)) return { error: t.files.missing };
	const id = createObject(db, input);
	if (fileIds.length) {
		const photoDate = String(form.get('photoDate') ?? '');
		createEvents(db, [id], {
			typeId: photoType(db).id,
			date: isValidDate(photoDate) ? photoDate : today,
			note: '',
			fields: [],
			fileIds
		});
	}
	return { id };
}
