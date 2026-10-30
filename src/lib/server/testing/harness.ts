import { randomUUID } from 'node:crypto';
import { fieldsFor } from '../../domain/eventFields.ts';
import { isFirstChange } from '../../domain/propertyHistory.ts';
import type { FieldKind } from '../../fieldKinds.ts';
import type { DiaryEvent, ValueCandidate } from '../../types.ts';
import type { Db } from '../db.ts';
import { parseEventForm, saveEditedEvent, saveNewEvent, validate } from '../eventForm.ts';
import {
	categoryImpact,
	deleteEvent,
	deleteObject,
	lastFieldsByType,
	listEvents,
	objectImpact,
	typeImpact
} from '../events.ts';
import { findPhotoType, listTypes, updateType } from '../eventTypes.ts';
import {
	getFieldKinds,
	propertyKeys,
	setFieldKind,
	setPropertyOrder,
	sortProperties
} from '../fields.ts';
import { parseObjectForm, saveNewObject } from '../objectForm.ts';
import {
	attrHistory,
	forgetInitialValue,
	listObjects,
	setCover,
	setInitialValue,
	updateObject
} from '../objects.ts';
import { getOverviewColumns, objectStats, setOverviewColumns } from '../overview.ts';
import { parseTypeForm } from '../typeForm.ts';
import { rename, vocabulary, type ValueKind } from '../vocab.ts';

/** A plain value keeps the value before the change as it is. `before: null` means not recorded. */
export type Change = string | { value: string; before: string | null };

type EventRef = { event: DiaryEvent; objectId: number };

/** A name in both `details` and `changes` is sent twice, as the form can send it. */
export type EventEntry = {
	objects: string[];
	type: string;
	category?: string;
	milestone?: boolean;
	date: string;
	note?: string;
	details?: Record<string, string>;
	changes?: Record<string, Change>;
	kinds?: Record<string, FieldKind>;
	files?: string[];
};

export type ObjectEntry = {
	properties?: Record<string, string>;
	kinds?: Record<string, FieldKind>;
	active?: boolean;
	notes?: string;
};

export type TypeEntry = {
	category?: string;
	milestone?: boolean;
	hint?: string;
	fields: { key: string; target?: 'event' | 'object'; default?: string; kind?: FieldKind }[];
};

const typeLabel = (category: string | null, name: string) =>
	category === null ? name : `${category}/${name}`;

/** Writes go through the same parsing and saving as the forms. Everything is addressed by name. */
export class Diary {
	constructor(
		readonly db: Db,
		readonly today = '2026-10-30'
	) {}

	objectId(name: string): number {
		const row = this.db.prepare('SELECT id FROM objects WHERE name = ?').get(name) as
			{ id: number } | undefined;
		if (!row) throw new Error(`No object ${name}`);
		return row.id;
	}

	typeId(label: string): number {
		const type = listTypes(this.db).find((ty) => typeLabel(ty.category, ty.name) === label);
		if (!type) throw new Error(`No type ${label}`);
		return type.id;
	}

	fileId(name: string): string {
		const row = this.db.prepare('SELECT id FROM files WHERE original_name = ?').get(name) as
			{ id: string } | undefined;
		if (!row) throw new Error(`No file ${name}`);
		return row.id;
	}

	/** The event as seen from one of its objects, as the object's timeline links to it. */
	event(object: string, date: string, type: string): EventRef {
		const objectId = this.objectId(object);
		const event = listEvents(this.db, { objectId, from: date, to: date }).find(
			(e) => typeLabel(e.category, e.typeName) === type
		);
		if (!event) throw new Error(`No event ${date} ${type} of ${object}`);
		return { event, objectId };
	}

	file(name: string, mime = 'image/jpeg') {
		const id = randomUUID();
		const size = mime.startsWith('image/') ? 3000 : null;
		this.db
			.prepare(
				'INSERT INTO files (id, file, mime, original_name, width, height) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.run(id, id, mime, name, size, size && size * 0.75);
	}

	object(
		name: string,
		entry: ObjectEntry = {},
		photos?: { files: string[]; date: string }
	): number {
		const form = this.objectForm(name, entry);
		for (const file of photos?.files ?? []) form.append('file', this.fileId(file));
		form.set('photoDate', photos?.date ?? '');
		const saved = saveNewObject(form, this.db, this.today);
		if ('error' in saved) throw new Error(saved.error);
		return saved.id;
	}

	editObject(name: string, entry: ObjectEntry & { name?: string }) {
		const id = this.objectId(name);
		const { input, error } = parseObjectForm(this.objectForm(entry.name ?? name, entry), this.db);
		if (error) throw new Error(error);
		updateObject(this.db, { ...input, id }, this.today);
	}

	record(entry: EventEntry): number {
		return saveNewEvent(this.db, this.eventForm(entry, null));
	}

	/** Like the form: "apply to all" selects all the event's objects. */
	edit({ event, objectId }: EventRef, entry: EventEntry & { applyToBatch?: boolean }) {
		const shared = event.objects.length > 1;
		const objects = entry.applyToBatch ? event.objects.map((o) => o.name) : entry.objects;
		const only = shared && !entry.applyToBatch ? objectId : null;
		saveEditedEvent(this.db, event.id, this.eventForm({ ...entry, objects }, only));
	}

	deleteEvent(id: number) {
		deleteEvent(this.db, id);
	}

	delete(object: string) {
		deleteObject(this.db, this.objectId(object));
	}

	setInitial(object: string, key: string, value: string) {
		setInitialValue(this.db, this.objectId(object), key, value);
	}

	forgetInitial(object: string, key: string) {
		forgetInitialValue(this.db, this.objectId(object), key);
	}

	cover(object: string, file: string) {
		setCover(this.db, this.objectId(object), this.fileId(file));
	}

	saveType(label: string, entry: TypeEntry): boolean {
		const form = new FormData();
		form.set('category', entry.category ?? '');
		if (entry.milestone) form.set('milestone', 'on');
		form.set('hint', entry.hint ?? '');
		for (const f of entry.fields) {
			form.append('fieldKey', f.key);
			form.append('fieldValue', f.default ?? '');
			form.append('fieldTarget', f.target ?? 'event');
			form.append('fieldKind', f.kind ? JSON.stringify(f.kind) : '');
		}
		return updateType(this.db, { id: this.typeId(label), ...parseTypeForm(form, this.db) });
	}

	columns(columns: Record<string, string[]>) {
		setOverviewColumns(
			this.db,
			Object.entries(columns).map(([label, types]) => ({
				label,
				typeIds: types.map((ty) => this.typeId(ty))
			}))
		);
	}

	order(keys: string[]) {
		setPropertyOrder(this.db, keys);
	}

	kind(key: string, kind: FieldKind) {
		setFieldKind(this.db, key, kind);
	}

	rename(what: ValueKind, from: string, to: string): number {
		return rename(this.db, what, from, to);
	}

	show(name: string): ObjectView {
		const object = view(this.db).objects.find((o) => o.name === name);
		if (!object) throw new Error(`No object ${name}`);
		return object;
	}

	private objectForm(name: string, entry: ObjectEntry): FormData {
		const form = new FormData();
		form.set('name', name);
		if (entry.active ?? true) form.set('active', 'on');
		form.set('notes', entry.notes ?? '');
		for (const [key, value] of Object.entries(entry.properties ?? {})) {
			form.append('attrKey', key);
			form.append('attrValue', value);
			form.append('attrKind', entry.kinds?.[key] ? JSON.stringify(entry.kinds[key]) : '');
		}
		return form;
	}

	private eventForm(entry: EventEntry, only: number | null) {
		const kind = (key: string) => entry.kinds?.[key];
		const fields = [
			...Object.entries(entry.details ?? {}).map(([key, value]) => ({
				key,
				value,
				target: 'event',
				kind: kind(key)
			})),
			...Object.entries(entry.changes ?? {}).map(([key, change]) =>
				typeof change === 'string'
					? { key, value: change, target: 'object', kind: kind(key) }
					: {
							key,
							value: change.value,
							target: 'object',
							initial:
								change.before === null
									? { kind: 'unknown' }
									: { kind: 'set', value: change.before },
							kind: kind(key)
						}
			)
		];
		const form = new FormData();
		form.set(
			'payload',
			JSON.stringify({
				objectIds: entry.objects.map((name) => this.objectId(name)),
				typeName: entry.type,
				category: entry.category ?? '',
				milestone: entry.milestone ?? false,
				date: entry.date,
				note: entry.note ?? '',
				fields,
				files: (entry.files ?? []).map((name) => this.fileId(name)),
				only
			})
		);
		const payload = parseEventForm(form, this.db);
		const error = validate(this.db, payload);
		if (error) throw new Error(error);
		return payload;
	}
}

export type DiaryView = ReturnType<typeof view>;
export type ObjectView = DiaryView['objects'][number];

/** What the pages show, without internal IDs. */
export function view(db: Db) {
	const types = listTypes(db);
	const typeOf = (id: number) => {
		const type = types.find((ty) => ty.id === id);
		return type ? typeLabel(type.category, type.name) : `? ${id}`;
	};
	const files = new Map(
		(
			db.prepare('SELECT id, original_name FROM files').all() as {
				id: string;
				original_name: string;
			}[]
		).map((f) => [f.id, f.original_name])
	);
	const events = listEvents(db, { limit: 1_000_000 });
	const ref = (id: number | null) => {
		const event = events.find((e) => e.id === id);
		return event ? `${event.date} ${typeOf(event.typeId)}` : null;
	};
	const showEvent = (e: DiaryEvent, objectId: number) => ({
		event: ref(e.id),
		objects: e.objects.map((o) => o.name).sort(),
		milestone: e.milestone,
		note: e.note,
		details: Object.fromEntries(
			e.fields.filter((f) => f.target === 'event').map((f) => [f.key, f.value])
		),
		changes: fieldsFor(e, objectId)
			.filter((f) => f.target === 'object')
			.map((f) => ({
				key: f.key,
				value: f.value,
				before: f.replaced?.value ?? null,
				first: isFirstChange(f.replaced)
			})),
		files: e.files.map((f) => f.name)
	});
	const candidates = (list: ValueCandidate[]) =>
		list
			.map((c) => ({
				value: c.value,
				count: c.count,
				last: c.last,
				byType: Object.fromEntries(
					Object.entries(c.byType)
						.map(([id, n]) => [typeOf(Number(id)), n] as const)
						.sort(([a], [b]) => a.localeCompare(b))
				)
			}))
			.sort((a, b) => a.value.localeCompare(b.value));
	const columns = getOverviewColumns(db);
	const stats = objectStats(db, columns);
	const photoType = findPhotoType(db);
	const vocab = vocabulary(db);
	const kinds = getFieldKinds(db);
	const categories = [
		...new Set(types.flatMap((ty) => (ty.category === null ? [] : [ty.category])))
	].sort();

	return {
		objects: listObjects(db).map((o) => {
			const history = attrHistory(db, o.id);
			return {
				name: o.name,
				active: o.active,
				notes: o.notes,
				cover: o.coverPhotoId && (files.get(o.coverPhotoId) ?? null),
				coverRatio: o.coverRatio,
				stats: stats.get(o.id) ?? null,
				impact: objectImpact(db, o.id),
				properties: Object.fromEntries(
					sortProperties(db, Object.keys(history)).map((key) => [
						key,
						history[key].map((h) => ({ value: h.value, since: h.since, by: ref(h.eventId) }))
					])
				),
				timeline: events
					.filter((e) => e.objects.some((eo) => eo.id === o.id))
					.map((e) => showEvent(e, o.id))
			};
		}),
		types: types.map((ty) => ({
			type: typeLabel(ty.category, ty.name),
			milestone: ty.milestone,
			hint: ty.hint,
			fields: ty.fields,
			count: ty.count,
			last: ty.last,
			impact: typeImpact(db, ty.id)
		})),
		categories: Object.fromEntries(categories.map((c) => [c, categoryImpact(db, c)])),
		photoType: photoType ? typeLabel(photoType.category, photoType.name) : null,
		lastFields: Object.fromEntries(
			Object.entries(lastFieldsByType(db))
				.map(
					([id, fields]) =>
						[
							typeOf(Number(id)),
							fields.map((f) => ({ key: f.key, value: f.value, target: f.target }))
						] as const
				)
				.sort(([a], [b]) => a.localeCompare(b))
		),
		columns: columns.map((c) => ({ label: c.label, types: c.typeIds.map(typeOf) })),
		propertyOrder: sortProperties(db, [...propertyKeys(db)]),
		kinds: Object.fromEntries(Object.entries(kinds).sort(([a], [b]) => a.localeCompare(b))),
		vocabulary: {
			categories: [...vocab.categories].sort((a, b) => a.value.localeCompare(b.value)),
			keys: { event: candidates(vocab.keys.event), object: candidates(vocab.keys.object) },
			values: Object.fromEntries(
				Object.entries(vocab.values)
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([key, list]) => [key, candidates(list)])
			)
		},
		storedFiles: [...files.values()].sort()
	};
}

/** The database as SQL, to keep a diary of this schema version as a fixture. */
export function dump(db: Db): string {
	const quote = (v: unknown) =>
		v === null ? 'NULL' : typeof v === 'string' ? `'${v.replaceAll("'", "''")}'` : String(v);
	const schema = db
		.prepare('SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY rowid')
		.all() as { type: string; name: string; sql: string }[];
	const rows = schema
		.filter((s) => s.type === 'table')
		.flatMap(({ name }) =>
			(db.prepare(`SELECT * FROM ${name}`).all() as Record<string, unknown>[]).map(
				(r) =>
					`INSERT INTO ${name} (${Object.keys(r).join(', ')}) VALUES (${Object.values(r).map(quote).join(', ')});`
			)
		);
	const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
	return [
		'PRAGMA foreign_keys = OFF;',
		...schema.map((s) => `${s.sql};`),
		...rows,
		`PRAGMA user_version = ${user_version};`,
		''
	].join('\n');
}
