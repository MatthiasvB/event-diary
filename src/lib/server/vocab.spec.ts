import { beforeEach, describe, expect, it } from 'vitest';
import type { Field } from '../types.ts';
import { openDb, type Db } from './db.ts';
import {
	categoryImpact,
	createEvents,
	deleteCategory,
	deleteObject,
	deleteType,
	getEvent,
	objectImpact,
	typeImpact
} from './events.ts';
import { parseEventForm } from './eventForm.ts';
import { ensureType, getType, photoType, updateType } from './eventTypes.ts';
import {
	attrHistory,
	createObject,
	currentAttrs,
	forgetInitialValue,
	getObject,
	setCover,
	setInitialValue,
	updateObject
} from './objects.ts';
import { getFieldKinds, learnKinds, setFieldKind } from './fieldKinds.ts';
import {
	getOverviewColumns,
	getPropertyOrder,
	setOverviewColumns,
	setPropertyOrder,
	sortProperties
} from './settings.ts';
import { rename, vocabulary } from './vocab.ts';

let db: Db;

/** Creates the object with this ID (objects are numbered in the order they are created). */
function object(id: number, attrs: Record<string, string> = {}) {
	const created = createObject(db, {
		name: `Objekt ${id}`,
		active: true,
		notes: '',
		attrs: Object.entries(attrs).map(([key, value]) => ({ key, value }))
	});
	expect(created).toBe(id);
}

beforeEach(() => {
	db = openDb(':memory:');
});

describe('rename and merge', () => {
	it('merges a misspelled value into the correct one everywhere', () => {
		object(1, { Gattung: 'Catleya' });
		object(2, { Gattung: 'Cattleya' });
		const type = ensureType(db, 'Umtopfen', {
			fields: [{ key: 'Gattung', target: 'event', default: 'Catleya' }]
		});
		createEvents(db, [1], {
			typeId: type.id,
			date: '2026-09-01',
			note: '',
			fields: [{ key: 'Gattung', value: 'Catleya', target: 'event' }],
			fileIds: []
		});

		expect(rename(db, { kind: 'value', key: 'Gattung' }, 'Catleya', 'Cattleya')).toBe(2);

		expect(currentAttrs(db).get(1)).toEqual({ Gattung: 'Cattleya' });
		expect(vocabulary(db).values.Gattung.map((v) => [v.value, v.count])).toEqual([['Cattleya', 3]]);
		expect(getType(db, type.id)?.fields[0].default).toBe('Cattleya');
	});

	it('renames keys and keeps both values when an event has both', () => {
		object(1);
		const type = ensureType(db, 'Düngen');
		const [id] = createEvents(db, [1], {
			typeId: type.id,
			date: '2026-09-01',
			note: '',
			fields: [
				{ key: 'Produkt', value: 'Obi', target: 'event' },
				{ key: 'Mittel', value: 'Flüssig', target: 'event' }
			],
			fileIds: []
		});

		rename(db, { kind: 'key' }, 'Mittel', 'Produkt');

		expect(getEvent(db, id)?.fields).toEqual([
			{ key: 'Produkt', value: 'Obi / Flüssig', target: 'event' }
		]);
		expect(getType(db, type.id)?.fields.map((f) => f.key)).toEqual(['Produkt']);
	});

	it('merges event types, moving their events and overview columns', () => {
		object(1);
		const typo = ensureType(db, 'Dügen', { category: 'Pflege' });
		const right = ensureType(db, 'Düngen', { category: 'Pflege' });
		const [id] = createEvents(db, [1], {
			typeId: typo.id,
			date: '2026-09-01',
			note: '',
			fields: [],
			fileIds: []
		});
		setOverviewColumns(db, [{ label: 'Gedüngt', typeIds: [typo.id, right.id] }]);

		rename(db, { kind: 'type' }, 'Dügen', 'Düngen');

		expect(getEvent(db, id)?.typeName).toBe('Düngen');
		expect(getType(db, typo.id)).toBeUndefined();
		expect(getOverviewColumns(db)).toEqual([{ label: 'Gedüngt', typeIds: [right.id] }]);
	});

	it('renames a type when the new name is free', () => {
		const type = ensureType(db, 'Giesen');
		rename(db, { kind: 'type' }, 'Giesen', 'Gießen');
		expect(getType(db, type.id)?.name).toBe('Gießen');
	});

	it('renames categories', () => {
		ensureType(db, 'Gießen', { category: 'pflege' });
		ensureType(db, 'Düngen', { category: 'Pflege' });
		rename(db, { kind: 'category' }, 'pflege', 'Pflege');
		expect(vocabulary(db).categories.map((c) => c.value)).toEqual(['Pflege']);
	});
});

describe('photo type', () => {
	it('is created once and remembered by ID across renames and merges', () => {
		const created = photoType(db);
		expect(created.name).toBe('Foto dokumentiert');
		expect(photoType(db).id).toBe(created.id);

		rename(db, { kind: 'type' }, 'Foto dokumentiert', 'Foto');
		expect(photoType(db)).toMatchObject({ id: created.id, name: 'Foto' });

		const other = ensureType(db, 'Fotodoku', { category: created.category });
		rename(db, { kind: 'type' }, 'Foto', 'Fotodoku');
		expect(photoType(db)).toMatchObject({ id: other.id, name: 'Fotodoku' });
		expect(getType(db, created.id)).toBeUndefined();
	});
});

describe('cover photo', () => {
	it('is the first photo and stays, until another one is chosen', () => {
		object(1);
		const type = ensureType(db, 'Foto dokumentiert');
		const photo = (id: string) =>
			db
				.prepare("INSERT INTO files (id, file, mime) VALUES (?, ?, 'image/jpeg')")
				.run(id, `${id}.jpg`);
		const event = (date: string, fileIds: string[]) =>
			createEvents(db, [1], { typeId: type.id, date, note: '', fields: [], fileIds });

		expect(getObject(db, 1)?.coverPhotoId).toBeNull();
		photo('a');
		event('2026-09-01', ['a']);
		expect(getObject(db, 1)?.coverPhotoId).toBe('a');
		photo('b');
		event('2026-10-01', ['b']);
		expect(getObject(db, 1)?.coverPhotoId).toBe('a');
		setCover(db, 1, 'b');
		expect(getObject(db, 1)?.coverPhotoId).toBe('b');
		// The pin is stored, not just derived.
		expect(db.prepare('SELECT cover_photo_id FROM objects WHERE id = 1').get()).toEqual({
			cover_photo_id: 'b'
		});
	});
});

describe('object attributes from events', () => {
	it('an event sets an object attribute from its date on, and deleting it restores the old value', () => {
		object(1, { Standort: 'Ostfenster' });
		const type = ensureType(db, 'Standortwechsel');
		const [id] = createEvents(db, [1], {
			typeId: type.id,
			date: '2026-09-20',
			note: '',
			fields: [{ key: 'Standort', value: 'Südfenster', target: 'object' }],
			fileIds: []
		});

		expect(currentAttrs(db).get(1)).toEqual({ Standort: 'Südfenster' });
		expect(attrHistory(db, 1).Standort.map((h) => [h.value, h.since])).toEqual([
			['Ostfenster', null],
			['Südfenster', '2026-09-20']
		]);
		// The type learned that it sets "Standort" on the object.
		expect(getType(db, type.id)?.fields).toEqual([{ key: 'Standort', target: 'object' }]);

		db.prepare('DELETE FROM events WHERE id = ?').run(id);
		expect(currentAttrs(db).get(1)).toEqual({ Standort: 'Ostfenster' });
	});

	it('can mark the value before a backdated change as not recorded', () => {
		// The object was entered with its current location, then an older move was added.
		object(1, { Standort: 'Südfenster' });
		const type = ensureType(db, 'Standortwechsel');
		const move = (date: string, value: string, previous?: string | null) =>
			createEvents(db, [1], {
				typeId: type.id,
				date,
				note: '',
				fields: [{ key: 'Standort', value, target: 'object', previous }],
				fileIds: []
			});

		move('2026-09-24', 'Südfenster', null);
		expect(attrHistory(db, 1).Standort.map((h) => [h.value, h.since])).toEqual([
			['Südfenster', '2026-09-24']
		]);

		// An even older recorded change means the value before it is known: nothing removed.
		object(2, { Standort: 'Ostfenster' });
		createEvents(db, [2], {
			typeId: type.id,
			date: '2026-03-01',
			note: '',
			fields: [{ key: 'Standort', value: 'Dachboden', target: 'object' }],
			fileIds: []
		});
		createEvents(db, [2], {
			typeId: type.id,
			date: '2026-09-24',
			note: '',
			fields: [{ key: 'Standort', value: 'Südfenster', target: 'object', previous: null }],
			fileIds: []
		});
		expect(attrHistory(db, 2).Standort).toHaveLength(3);

		forgetInitialValue(db, 2, 'Standort');
		expect(attrHistory(db, 2).Standort.map((h) => h.value)).toEqual(['Dachboden', 'Südfenster']);
	});

	it('can set the known value before a backdated change', () => {
		object(1, { Standort: 'Südfenster' });
		const type = ensureType(db, 'Standortwechsel');
		createEvents(db, [1], {
			typeId: type.id,
			date: '2026-09-24',
			note: '',
			fields: [{ key: 'Standort', value: 'Südfenster', target: 'object', previous: 'Ostfenster' }],
			fileIds: []
		});
		const history = () => attrHistory(db, 1).Standort.map((h) => [h.value, h.since]);
		expect(history()).toEqual([
			['Ostfenster', null],
			['Südfenster', '2026-09-24']
		]);

		// Directly on the object: also adds an initial value where none was recorded.
		forgetInitialValue(db, 1, 'Standort');
		setInitialValue(db, 1, 'Standort', 'Dachboden');
		expect(history()).toEqual([
			['Dachboden', null],
			['Südfenster', '2026-09-24']
		]);
		expect(currentAttrs(db).get(1)).toEqual({ Standort: 'Südfenster' });
	});
});

describe('changes of properties', () => {
	const type = () => ensureType(db, 'Umtopfen');
	const repot = (objectId: number, date: string, field: Partial<Field>) =>
		createEvents(db, [objectId], {
			typeId: type().id,
			date,
			note: '',
			fields: [{ key: 'Substrat', value: '', target: 'object', ...field }],
			fileIds: []
		})[0];

	it('show the value they replaced', () => {
		object(1, { Substrat: 'Moos' });
		const first = repot(1, '2026-03-01', { value: 'Rinde' });
		const second = repot(1, '2026-09-01', { value: 'Lava' });
		const change = (id: number) => getEvent(db, id)?.fields[0];
		expect(change(first)).toMatchObject({ value: 'Rinde', before: 'Moos', firstChange: true });
		expect(change(second)).toMatchObject({ value: 'Lava', before: 'Rinde', firstChange: false });

		// Without a recorded initial value, the first change replaced an unknown one.
		forgetInitialValue(db, 1, 'Substrat');
		expect(change(first)).toMatchObject({ before: null, firstChange: true });
	});

	it('set the value before only for the first change', () => {
		object(1, { Substrat: 'Moos' });
		repot(1, '2026-03-01', { value: 'Rinde' });
		// A later change: the value before it is the earlier change's, so nothing is set.
		repot(1, '2026-09-01', { value: 'Lava', previous: 'Erde' });
		repot(1, '2026-10-01', { value: 'Lava', previous: null });
		expect(attrHistory(db, 1).Substrat.map((h) => h.value)).toEqual([
			'Moos',
			'Rinde',
			'Lava',
			'Lava'
		]);
		// A change on the same day as an earlier one isn't the first either.
		repot(1, '2026-03-01', { value: 'Bims', previous: 'Erde' });
		expect(attrHistory(db, 1).Substrat[0].value).toBe('Moos');
	});

	it('take along event details of a name that becomes a property', () => {
		object(1);
		object(2, { Standort: 'Küche' });
		const ty = type();
		const detail = (objectId: number, date: string, value: string) =>
			createEvents(db, [objectId], {
				typeId: ty.id,
				date,
				note: '',
				fields: [{ key: 'Substrat', value, target: 'event' }],
				fileIds: []
			})[0];
		detail(1, '2026-01-10', 'Moos');
		const later = detail(1, '2026-05-01', 'Rinde');
		detail(2, '2026-02-01', 'Erde');
		expect(getType(db, ty.id)?.fields).toEqual([{ key: 'Substrat', target: 'event' }]);

		// Object 2 gets "Substrat" as a property: all events' values become its changes.
		updateObject(
			db,
			{
				id: 2,
				name: 'Objekt 2',
				active: true,
				notes: '',
				attrs: [
					{ key: 'Standort', value: 'Küche' },
					{ key: 'Substrat', value: 'Erde' }
				]
			},
			'2026-10-29'
		);
		expect(attrHistory(db, 1).Substrat.map((h) => [h.value, h.since])).toEqual([
			['Moos', '2026-01-10'],
			['Rinde', '2026-05-01']
		]);
		// Entered with the value it already has: no extra change.
		expect(attrHistory(db, 2).Substrat.map((h) => [h.value, h.since])).toEqual([
			['Erde', '2026-02-01']
		]);
		expect(getEvent(db, later)?.fields).toEqual([
			{
				key: 'Substrat',
				value: 'Rinde',
				target: 'object',
				before: 'Moos',
				firstChange: false
			}
		]);
		expect(db.prepare('SELECT count(*) AS n FROM event_attrs').get()).toEqual({ n: 0 });
		expect(getType(db, ty.id)?.fields).toEqual([{ key: 'Substrat', target: 'object' }]);

		expect(vocabulary(db).keys.event).toEqual([]);

		// From now on the name changes the object even when sent as an event detail.
		const form = new FormData();
		form.set(
			'payload',
			JSON.stringify({
				objectIds: [1],
				fields: [
					{ key: 'Substrat', value: 'Lava', target: 'event' },
					{ key: 'Menge', value: '2 l', target: 'event' }
				]
			})
		);
		expect(parseEventForm(form, db).fields.map((f) => f.target)).toEqual(['object', 'event']);
	});
});

describe('deleting an object', () => {
	it('removes its events and photos, but not what other objects still use', () => {
		object(1, { Standort: 'Küche' });
		object(2);
		const type = ensureType(db, 'Umtopfen');
		for (const id of ['own', 'shared']) {
			db.prepare("INSERT INTO files (id, file, mime) VALUES (?, ?, 'image/jpeg')").run(id, id);
		}
		const input = { typeId: type.id, note: '', fields: [] };
		createEvents(db, [1], { ...input, date: '2026-09-01', fileIds: ['own'] });
		const [, kept] = createEvents(db, [1, 2], {
			...input,
			date: '2026-09-02',
			fileIds: ['shared']
		});

		expect(objectImpact(db, 1)).toEqual({ events: 2, files: 1 });
		deleteObject(db, 1);

		expect(getObject(db, 1)).toBeUndefined();
		expect(db.prepare('SELECT count(*) AS n FROM events WHERE object_id = 1').get()).toEqual({
			n: 0
		});
		expect(db.prepare('SELECT count(*) AS n FROM object_attrs WHERE object_id = 1').get()).toEqual({
			n: 0
		});
		expect(getEvent(db, kept)?.objectId).toBe(2);
		expect(getEvent(db, kept)?.files.map((f) => f.id)).toEqual(['shared']);
		const photos = db
			.prepare('SELECT id FROM files')
			.all()
			.map((r) => r.id);
		expect(photos).toEqual(['shared']);
	});
});

describe('deleting event types and categories', () => {
	it('takes their events and photos along, and attributes fall back', () => {
		object(1, { Standort: 'Küche' });
		db.prepare("INSERT INTO files (id, file, mime) VALUES ('p', 'p', 'image/jpeg')").run();
		const move = ensureType(db, 'Umzug', { category: 'Pflege' });
		const water = ensureType(db, 'Gießen', { category: 'Pflege' });
		const bloom = ensureType(db, 'Blüte', { category: 'Beobachtung' });
		const input = { note: '', fields: [], fileIds: [] };
		createEvents(db, [1], {
			...input,
			typeId: move.id,
			date: '2026-09-01',
			fields: [{ key: 'Standort', value: 'Bad', target: 'object' }],
			fileIds: ['p']
		});
		createEvents(db, [1], { ...input, typeId: water.id, date: '2026-09-02' });
		const [kept] = createEvents(db, [1], { ...input, typeId: bloom.id, date: '2026-09-03' });
		expect(currentAttrs(db).get(1)).toEqual({ Standort: 'Bad' });

		expect(typeImpact(db, water.id)).toEqual({ events: 1, files: 0 });
		deleteType(db, water.id);
		expect(getType(db, water.id)).toBeUndefined();

		expect(categoryImpact(db, 'Pflege')).toEqual({ events: 1, files: 1 });
		deleteCategory(db, 'Pflege');
		expect(getType(db, move.id)).toBeUndefined();
		expect(currentAttrs(db).get(1)).toEqual({ Standort: 'Küche' });
		expect(db.prepare('SELECT count(*) AS n FROM files').get()).toEqual({ n: 0 });
		expect(
			db
				.prepare('SELECT id FROM events')
				.all()
				.map((r) => r.id)
		).toEqual([kept]);
		expect(getType(db, bloom.id)).toBeDefined();
	});
});

describe('types of the same name in several categories', () => {
	it('are separate types, picked by name and category', () => {
		const care = ensureType(db, 'Umtopfen', { category: 'Pflege' });
		const house = ensureType(db, 'Umtopfen', { category: 'Haus' });
		expect(house.id).not.toBe(care.id);
		expect(ensureType(db, 'Umtopfen', { category: 'Haus' }).id).toBe(house.id);
		expect(ensureType(db, 'Umtopfen').category).toBe('');
	});

	it('are merged when renaming brings them into one category', () => {
		object(1);
		const care = ensureType(db, 'Umtopfen', { category: 'Pflege' });
		const house = ensureType(db, 'Umtopfen', { category: 'Haus' });
		const water = ensureType(db, 'Gießen', { category: 'Haus' });
		const input = { note: '', fields: [], fileIds: [], date: '2026-09-01' };
		const [moved] = createEvents(db, [1], { ...input, typeId: house.id });

		rename(db, { kind: 'category' }, 'Haus', 'Pflege');

		expect(getType(db, house.id)).toBeUndefined();
		expect(getEvent(db, moved)?.typeId).toBe(care.id);
		expect(getType(db, water.id)?.category).toBe('Pflege');
	});

	it("can't be moved into a category that already has the name", () => {
		const care = ensureType(db, 'Umtopfen', { category: 'Pflege' });
		const house = ensureType(db, 'Umtopfen', { category: 'Haus' });
		const update = { id: house.id, milestone: false, hint: '', fields: [] };
		expect(updateType(db, { ...update, category: 'Pflege' })).toBe(false);
		expect(updateType(db, { ...update, category: 'Garten' })).toBe(true);
		expect(getType(db, care.id)?.category).toBe('Pflege');
	});
});

describe('field kinds', () => {
	it('stay with a field name when it is renamed, and plain text is not stored', () => {
		setFieldKind(db, 'Hoehe', { kind: 'number', unit: 'cm' });
		setFieldKind(db, 'Notiz', { kind: 'text', unit: 'x' });
		rename(db, { kind: 'key' }, 'Hoehe', 'Höhe');
		expect(getFieldKinds(db)).toEqual({ Höhe: { kind: 'number', unit: 'cm' } });

		setFieldKind(db, 'Breite', { kind: 'date', unit: 'ignored' });
		rename(db, { kind: 'key' }, 'Breite', 'Höhe');
		expect(getFieldKinds(db)).toEqual({ Höhe: { kind: 'number', unit: 'cm' } });
	});
});

describe('kinds chosen for new names', () => {
	it('apply only to names that are neither used nor typed yet', () => {
		object(1, { Standort: 'Küche' });
		ensureType(db, 'Umtopfen', { fields: [{ key: 'Substrat', target: 'event' }] });
		setFieldKind(db, 'Erworben am', { kind: 'date', unit: '' });

		const kinds = learnKinds(db, {
			Höhe: { kind: 'number', unit: 'cm' },
			Standort: { kind: 'date', unit: '' },
			Substrat: { kind: 'number', unit: 'l' },
			'Erworben am': { kind: 'number', unit: '' },
			Notiz: { kind: 'text', unit: '' }
		});

		expect(kinds).toEqual({
			'Erworben am': { kind: 'date', unit: '' },
			Höhe: { kind: 'number', unit: 'cm' }
		});
		expect(getFieldKinds(db)).toEqual(kinds);
	});
});

describe('property order', () => {
	it('puts arranged names first, the others alphabetically, and follows renames', () => {
		const keys = ['Substrat', 'Standort', 'Erworben am', 'Art'];
		expect(sortProperties(db, keys)).toEqual(['Art', 'Erworben am', 'Standort', 'Substrat']);
		setPropertyOrder(db, ['Standort', 'Erworben am', 'Standort', '']);
		expect(getPropertyOrder(db)).toEqual(['Standort', 'Erworben am']);
		expect(sortProperties(db, keys)).toEqual(['Standort', 'Erworben am', 'Art', 'Substrat']);

		rename(db, { kind: 'key' }, 'Erworben am', 'Gekauft am');
		expect(getPropertyOrder(db)).toEqual(['Standort', 'Gekauft am']);
		// Merged into a name that has a place: that place wins.
		rename(db, { kind: 'key' }, 'Gekauft am', 'Standort');
		expect(getPropertyOrder(db)).toEqual(['Standort']);
	});
});
