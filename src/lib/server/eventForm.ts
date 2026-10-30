import { kindOf, parseKind, storedValue } from '../fieldKinds.ts';
import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import type { Field } from '../types.ts';
import type { Db } from './db.ts';
import { createEvents, updateEvent } from './events.ts';
import { ensureType } from './eventTypes.ts';
import { learnKinds, propertyKeys, type ChosenKind } from './fields.ts';
import { deleteFiles, FILE_ID, filesExist } from './files.ts';

export type EventPayload = {
	objectIds: number[];
	typeName: string;
	category: string;
	milestone: boolean;
	date: string;
	note: string;
	fields: Field[];
	files: string[];
	applyToBatch: boolean;
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function chosenKinds(
	fields: { key?: unknown; kind?: unknown; target?: unknown }[]
): ChosenKind[] {
	return fields.flatMap((f) => {
		const kind = parseKind(f?.kind);
		const role = f?.target === 'object' ? ('property' as const) : ('detail' as const);
		return kind && str(f?.key) ? [{ name: str(f?.key), role, kind }] : [];
	});
}

/** Stores kinds chosen for new field names right away. */
export function parseEventForm(form: FormData, db: Db): EventPayload {
	const raw = JSON.parse(String(form.get('payload') ?? '{}')) as Record<string, unknown>;
	const list = (v: unknown) => (Array.isArray(v) ? v : []);
	const kinds = learnKinds(db, chosenKinds(list(raw.fields)));
	const properties = propertyKeys(db);
	const targetOf = (f: { key?: unknown; target?: unknown }) =>
		properties.has(str(f?.key)) || f?.target === 'object'
			? ('object' as const)
			: ('event' as const);
	const payload: EventPayload = {
		objectIds: [...new Set(list(raw.objectIds).map(Number))].filter(
			(id) => Number.isInteger(id) && id > 0
		),
		typeName: str(raw.typeName),
		category: str(raw.category),
		milestone: raw.milestone === true,
		date: str(raw.date),
		note: str(raw.note),
		fields: list(raw.fields)
			.map((f) => ({
				key: str(f?.key),
				value: storedValue(str(f?.value), kindOf(kinds, str(f?.key))),
				target: targetOf(f),
				previous:
					targetOf(f) !== 'object' || f.previous === undefined
						? undefined
						: f.previous === null
							? null
							: storedValue(str(f.previous), kindOf(kinds, str(f?.key))) || undefined
			}))
			.filter((f) => f.key && f.value),
		files: [...new Set(list(raw.files).map(str))].filter((id) => FILE_ID.test(id)),
		applyToBatch: raw.applyToBatch === true
	};
	return payload;
}

export function validate(db: Db, p: EventPayload): string | null {
	if (!p.objectIds.length) return t.events.noObjects;
	const exists = db.prepare('SELECT 1 FROM objects WHERE id = ?');
	if (p.objectIds.some((id) => !exists.get(id))) return t.events.noObjects;
	if (!p.typeName) return t.events.noType;
	if (!isValidDate(p.date)) return t.events.badDate;
	if (!filesExist(db, p.files)) return t.files.missing;
	return null;
}

function resolveType(db: Db, p: EventPayload) {
	return ensureType(db, p.typeName, { category: p.category, milestone: p.milestone });
}

export function saveNewEvents(db: Db, p: EventPayload): number[] {
	const type = resolveType(db, p);
	return createEvents(db, p.objectIds, { ...p, typeId: type.id, fileIds: p.files });
}

export function saveEditedEvent(db: Db, id: number, p: EventPayload) {
	const type = resolveType(db, p);
	const orphans = updateEvent(
		db,
		id,
		{ ...p, objectId: p.objectIds[0], typeId: type.id, fileIds: p.files },
		p.applyToBatch
	);
	deleteFiles(db, orphans);
}
