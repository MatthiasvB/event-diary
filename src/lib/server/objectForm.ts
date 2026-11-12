import { formatTarget } from '../domain/associations.ts';
import { kindOf, storedValue } from '../fieldKinds.ts';
import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import type { Db } from './db.ts';
import { chosenNames } from './eventForm.ts';
import { createEvent } from './events.ts';
import { photoType } from './eventTypes.ts';
import { getFieldKinds, learnChoices } from './fields.ts';
import { FILE_ID, filesExist } from './files.ts';
import {
	createObject,
	getObject,
	resolveTargets,
	setInitialValue,
	setProperty,
	updateObject,
	type ObjectInput
} from './objects.ts';
import { savedUnlessRefused, type Refusal } from './refusals.ts';
import { addMove, stockLocked } from './units.ts';

/** Stores what is chosen for new property names right away. */
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
	const chosen = form.getAll('attrChoice').map(String);
	const kinds = learnChoices(
		db,
		chosenNames(keys.map((key, i) => ({ key, chosen: chosen[i], target: 'object' })))
	);
	const input = {
		name: get('name'),
		active: form.get('active') === 'on',
		listed: form.get('listed') === 'on',
		stock: form.get('stock') === 'on',
		notes: get('notes'),
		attrs: keys
			.map((key, i) => ({ key, value: storedValue(values[i] ?? '', kindOf(kinds, key)) }))
			.filter((a) => a.key)
	};
	const associated = input.attrs.some((a) => a.value && kindOf(kinds, a.key).kind === 'object');
	const error = !input.name
		? t.objects.nameRequired
		: input.stock && associated
			? t.units.noAssociations
			: null;
	return { input, error };
}

/**
 * Photos sent along become a photo event, on their capture date if known. A stock's count
 * is there from the start, not assigned to any object.
 */
export function saveNewObject(form: FormData, db: Db, today: string): { id: number } | Refusal {
	const { input, error } = parseObjectForm(form, db);
	if (error) return { error };
	const count = input.stock ? Number(form.get('count') || 0) : 0;
	if (!Number.isInteger(count) || count < 0) return { error: t.units.badCount };
	const fileIds = form
		.getAll('file')
		.map(String)
		.filter((id) => FILE_ID.test(id));
	if (!filesExist(db, fileIds)) return { error: t.files.missing };
	return savedUnlessRefused(db, () => {
		const attrs = resolveTargets(db, getFieldKinds(db), input.attrs);
		const id = createObject(db, { ...input, attrs });
		if (count) addMove(db, id, { kind: 'add', quantity: count, to: null }, { since: null });
		if (fileIds.length) {
			const photoDate = String(form.get('photoDate') ?? '');
			createEvent(db, [id], {
				typeId: photoType(db).id,
				date: isValidDate(photoDate) ? photoDate : today,
				note: '',
				fields: [],
				moves: [],
				fileIds
			});
		}
		return { id };
	});
}

export function saveEditedObject(
	form: FormData,
	db: Db,
	id: number,
	today: string
): Refusal | null {
	const { input, error } = parseObjectForm(form, db);
	if (error) return { error };
	const switched = getObject(db, id)?.stock !== input.stock;
	if (switched && stockLocked(db, id)) return { error: t.units.locked };
	return savedUnlessRefused(db, () => {
		const attrs = resolveTargets(db, getFieldKinds(db), input.attrs);
		updateObject(db, { ...input, id, attrs }, today);
		return null;
	});
}

/** Points each object's `key` to the holder, as an edit on the object would. */
export function associateWith(
	db: Db,
	holderId: number,
	key: string,
	objectIds: number[],
	today: string
): Refusal | null {
	if (
		kindOf(getFieldKinds(db), key).kind !== 'object' ||
		getObject(db, holderId)?.stock !== false
	) {
		return { error: t.errors.generic };
	}
	return savedUnlessRefused(db, () => {
		for (const id of objectIds.filter((id) => getObject(db, id)?.stock === false)) {
			setProperty(db, id, key, formatTarget({ id: holderId }), today);
		}
		return null;
	});
}

/** The value before an object's first change of `key`, as entered. */
export function saveInitialValue(
	db: Db,
	objectId: number,
	key: string,
	entered: string
): Refusal | null {
	return savedUnlessRefused(db, () => {
		const kinds = getFieldKinds(db);
		const [initial] = resolveTargets(db, kinds, [
			{ key, value: storedValue(entered, kindOf(kinds, key)) }
		]);
		if (initial?.value) setInitialValue(db, objectId, key, initial.value);
		return null;
	});
}
