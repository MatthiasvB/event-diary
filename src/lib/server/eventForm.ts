import { kindOf, parseKind, storedValue, type FieldKind } from '../fieldKinds.ts';
import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import { KEEP, type FieldEntry, type InitialChoice } from '../types.ts';
import type { Db } from './db.ts';
import { createEvent, updateEvent } from './events.ts';
import { ensureType } from './eventTypes.ts';
import { learnKinds, propertyKeys, type ChosenKind } from './fields.ts';
import { deleteFiles, FILE_ID, filesExist } from './files.ts';

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

export function chosenKinds(
	fields: { key?: unknown; kind?: unknown; target?: unknown }[]
): ChosenKind[] {
	return fields.flatMap((f) => {
		const kind = parseKind(f?.kind);
		const role = f?.target === 'object' ? ('property' as const) : ('detail' as const);
		return kind && str(f?.key) ? [{ name: str(f?.key), role, kind }] : [];
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
	const kinds = learnKinds(db, chosenKinds(list(raw.fields)));
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

export function saveNewEvent(db: Db, p: EventPayload): number {
	const type = resolveType(db, p);
	return createEvent(db, p.objectIds, { ...p, typeId: type.id, fileIds: p.files });
}

export function saveEditedEvent(db: Db, id: number, p: EventPayload) {
	const type = resolveType(db, p);
	const orphans = updateEvent(db, id, { ...p, typeId: type.id, fileIds: p.files }, p.only);
	deleteFiles(db, orphans);
}
