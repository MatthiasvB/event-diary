import { kindOf, parseChoice, storedValue, type FieldKind } from '../fieldKinds.ts';
import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import { KEEP, type FieldEntry, type InitialChoice } from '../types.ts';
import type { Db } from './db.ts';
import { createEvent, updateEvent } from './events.ts';
import { ensureType } from './eventTypes.ts';
import { getFieldKinds, learnChoices, propertyKeys, type ChosenName } from './fields.ts';
import { deleteFiles, FILE_ID, filesExist } from './files.ts';
import { resolveTargets } from './objects.ts';
import { savedUnlessRefused, type Refusal } from './refusals.ts';

export type EventPayload = {
	objectIds: number[];
	typeName: string;
	category: string | null;
	milestone: boolean;
	date: string;
	note: string;
	fields: FieldEntry[];
	files: string[];
	/** On an event of several objects: the one whose part alone is edited. */
	only: number | null;
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function chosenNames(
	fields: { key?: unknown; chosen?: unknown; target?: unknown }[]
): ChosenName[] {
	return fields.flatMap((f) => {
		const choice = parseChoice(f?.chosen);
		const role = f?.target === 'object' ? ('property' as const) : ('detail' as const);
		return choice && str(f?.key) ? [{ ...choice, name: str(f?.key), role }] : [];
	});
}

function parseInitial(raw: unknown, kind: FieldKind): InitialChoice {
	const r = raw as { kind?: unknown; value?: unknown } | null | undefined;
	if (r?.kind === 'unknown') return { kind: 'unknown' };
	const value = r?.kind === 'set' ? storedValue(str(r.value), kind) : '';
	return value ? { kind: 'set', value } : KEEP;
}

/** Stores kinds chosen for new field names right away. */
export function parseEventForm(form: FormData, db: Db): EventPayload {
	const raw = JSON.parse(String(form.get('payload') ?? '{}')) as Record<string, unknown>;
	const list = (v: unknown) => (Array.isArray(v) ? v : []);
	const kinds = learnChoices(db, chosenNames(list(raw.fields)));
	const properties = propertyKeys(db);
	const payload: EventPayload = {
		objectIds: [...new Set(list(raw.objectIds).map(Number))].filter(
			(id) => Number.isInteger(id) && id > 0
		),
		typeName: str(raw.typeName),
		category: str(raw.category) || null,
		milestone: raw.milestone === true,
		date: str(raw.date),
		note: str(raw.note),
		fields: list(raw.fields).flatMap((f): FieldEntry[] => {
			const key = str(f?.key);
			const kind = kindOf(kinds, key);
			const value = storedValue(str(f?.value), kind);
			if (!key || !value) return [];
			if (!properties.has(key) && f?.target !== 'object') return [{ target: 'event', key, value }];
			return [{ target: 'object', key, value, initial: parseInitial(f?.initial, kind) }];
		}),
		files: [...new Set(list(raw.files).map(str))].filter((id) => FILE_ID.test(id)),
		only: Number.isInteger(raw.only) && Number(raw.only) > 0 ? Number(raw.only) : null
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

/** Values of associations that name a new object create it. */
function resolveFields(db: Db, fields: FieldEntry[]): FieldEntry[] {
	const kinds = getFieldKinds(db);
	return resolveTargets(db, kinds, fields).map((f) => {
		if (f.target !== 'object' || f.initial.kind !== 'set') return f;
		const [initial] = resolveTargets(db, kinds, [{ key: f.key, value: f.initial.value }]);
		return { ...f, initial: initial ? { kind: 'set', value: initial.value } : KEEP };
	});
}

export function saveNewEvent(db: Db, p: EventPayload): { id: number } | Refusal {
	return savedUnlessRefused(db, () => {
		const type = resolveType(db, p);
		const fields = resolveFields(db, p.fields);
		return {
			id: createEvent(db, p.objectIds, { ...p, fields, typeId: type.id, fileIds: p.files })
		};
	});
}

export function saveEditedEvent(db: Db, id: number, p: EventPayload): Refusal | null {
	const orphans = savedUnlessRefused(db, () => {
		const type = resolveType(db, p);
		const fields = resolveFields(db, p.fields);
		return updateEvent(db, id, { ...p, fields, typeId: type.id, fileIds: p.files }, p.only);
	});
	if ('error' in orphans) return orphans;
	deleteFiles(db, orphans);
	return null;
}
