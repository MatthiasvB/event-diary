// Parsing and saving the event form (new, repeat, edit).
import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import type { Field } from '../types.ts';
import type { Db } from './db.ts';
import { createEvents, updateEvent } from './events.ts';
import { ensureType } from './eventTypes.ts';
import { deleteFiles, FILE_ID, filesExist } from './files.ts';

export type EventPayload = {
	plantIds: string[];
	typeName: string;
	category: string;
	milestone: boolean;
	date: string;
	note: string;
	fields: Field[];
	/** Attached files in order: kept ones (edit) and new ones, uploaded beforehand. */
	files: string[];
	applyToBatch: boolean;
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function parseEventForm(form: FormData): EventPayload {
	const raw = JSON.parse(String(form.get('payload') ?? '{}')) as Record<string, unknown>;
	const list = (v: unknown) => (Array.isArray(v) ? v : []);
	const payload: EventPayload = {
		plantIds: [...new Set(list(raw.plantIds).map(str).filter(Boolean))],
		typeName: str(raw.typeName),
		category: str(raw.category),
		milestone: raw.milestone === true,
		date: str(raw.date),
		note: str(raw.note),
		fields: list(raw.fields)
			.map((f) => ({
				key: str(f?.key),
				value: str(f?.value),
				target: f?.target === 'plant' ? ('plant' as const) : ('event' as const),
				previous:
					f?.target !== 'plant'
						? undefined
						: f.previous === null
							? null
							: str(f.previous) || undefined
			}))
			.filter((f) => f.key && f.value),
		files: [...new Set(list(raw.files).map(str))].filter((id) => FILE_ID.test(id)),
		applyToBatch: raw.applyToBatch === true
	};
	return payload;
}

export function validate(db: Db, p: EventPayload): string | null {
	if (!p.plantIds.length) return t.events.noPlants;
	const exists = db.prepare('SELECT 1 FROM plants WHERE id = ?');
	if (p.plantIds.some((id) => !exists.get(id))) return t.events.noPlants;
	if (!p.typeName) return t.events.noType;
	if (!isValidDate(p.date)) return t.events.badDate;
	if (!filesExist(db, p.files)) return t.files.missing;
	return null;
}

function resolveType(db: Db, p: EventPayload) {
	// A new type is created on the fly, learning its fields from this first use.
	return ensureType(db, p.typeName, {
		category: p.category,
		milestone: p.milestone,
		fields: p.fields.map((f) => ({ key: f.key, target: f.target }))
	});
}

export function saveNewEvents(db: Db, p: EventPayload): number[] {
	const type = resolveType(db, p);
	return createEvents(db, p.plantIds, { ...p, typeId: type.id, fileIds: p.files });
}

export function saveEditedEvent(db: Db, id: number, p: EventPayload) {
	const type = resolveType(db, p);
	const orphans = updateEvent(
		db,
		id,
		{ ...p, plantId: p.plantIds[0], typeId: type.id, fileIds: p.files },
		p.applyToBatch
	);
	deleteFiles(db, orphans);
}
