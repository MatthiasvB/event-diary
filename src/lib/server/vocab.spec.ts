import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db.ts';
import {
	categoryImpact,
	createEvents,
	deleteCategory,
	deletePlant,
	deleteType,
	getEvent,
	plantImpact,
	typeImpact
} from './events.ts';
import { ensureType, getType, photoType, updateType } from './eventTypes.ts';
import {
	attrHistory,
	createPlant,
	currentAttrs,
	forgetInitialValue,
	getPlant,
	setCover,
	setInitialValue
} from './plants.ts';
import { getOverviewColumns, setOverviewColumns } from './settings.ts';
import { rename, vocabulary } from './vocab.ts';

let db: Db;

function plant(id: string, attrs: Record<string, string> = {}) {
	createPlant(db, {
		id,
		name: id,
		active: true,
		acquiredOn: '2026-01-01',
		notes: '',
		attrs: Object.entries(attrs).map(([key, value]) => ({ key, value }))
	});
}

beforeEach(() => {
	db = openDb(':memory:');
});

describe('rename and merge', () => {
	it('merges a misspelled value into the correct one everywhere', () => {
		plant('P-001', { Gattung: 'Catleya' });
		plant('P-002', { Gattung: 'Cattleya' });
		const type = ensureType(db, 'Umtopfen', {
			fields: [{ key: 'Gattung', target: 'event', default: 'Catleya' }]
		});
		createEvents(db, ['P-001'], {
			typeId: type.id,
			date: '2026-09-01',
			note: '',
			fields: [{ key: 'Gattung', value: 'Catleya', target: 'event' }],
			photoIds: []
		});

		expect(rename(db, { kind: 'value', key: 'Gattung' }, 'Catleya', 'Cattleya')).toBe(2);

		expect(currentAttrs(db).get('P-001')).toEqual({ Gattung: 'Cattleya' });
		expect(vocabulary(db).values.Gattung.map((v) => [v.value, v.count])).toEqual([['Cattleya', 3]]);
		expect(getType(db, type.id)?.fields[0].default).toBe('Cattleya');
	});

	it('renames keys and keeps both values when an event has both', () => {
		plant('P-001');
		const type = ensureType(db, 'Düngen');
		const [id] = createEvents(db, ['P-001'], {
			typeId: type.id,
			date: '2026-09-01',
			note: '',
			fields: [
				{ key: 'Produkt', value: 'Obi', target: 'event' },
				{ key: 'Mittel', value: 'Flüssig', target: 'event' }
			],
			photoIds: []
		});

		rename(db, { kind: 'key' }, 'Mittel', 'Produkt');

		expect(getEvent(db, id)?.fields).toEqual([
			{ key: 'Produkt', value: 'Obi / Flüssig', target: 'event' }
		]);
		expect(getType(db, type.id)?.fields.map((f) => f.key)).toEqual(['Produkt']);
	});

	it('merges event types, moving their events and overview columns', () => {
		plant('P-001');
		const typo = ensureType(db, 'Dügen', { category: 'Pflege' });
		const right = ensureType(db, 'Düngen', { category: 'Pflege' });
		const [id] = createEvents(db, ['P-001'], {
			typeId: typo.id,
			date: '2026-09-01',
			note: '',
			fields: [],
			photoIds: []
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
		plant('P-001');
		const type = ensureType(db, 'Foto dokumentiert');
		const photo = (id: string) =>
			db
				.prepare("INSERT INTO photos (id, file, mime) VALUES (?, ?, 'image/jpeg')")
				.run(id, `${id}.jpg`);
		const event = (date: string, photoIds: string[]) =>
			createEvents(db, ['P-001'], { typeId: type.id, date, note: '', fields: [], photoIds });

		expect(getPlant(db, 'P-001')?.coverPhotoId).toBeNull();
		photo('a');
		event('2026-09-01', ['a']);
		expect(getPlant(db, 'P-001')?.coverPhotoId).toBe('a');
		photo('b');
		event('2026-10-01', ['b']);
		expect(getPlant(db, 'P-001')?.coverPhotoId).toBe('a');
		setCover(db, 'P-001', 'b');
		expect(getPlant(db, 'P-001')?.coverPhotoId).toBe('b');
		// The pin is stored, not just derived.
		expect(db.prepare("SELECT cover_photo_id FROM plants WHERE id = 'P-001'").get()).toEqual({
			cover_photo_id: 'b'
		});
	});
});

describe('plant attributes from events', () => {
	it('an event sets a plant attribute from its date on, and deleting it restores the old value', () => {
		plant('P-001', { Standort: 'Ostfenster' });
		const type = ensureType(db, 'Standortwechsel');
		const [id] = createEvents(db, ['P-001'], {
			typeId: type.id,
			date: '2026-09-20',
			note: '',
			fields: [{ key: 'Standort', value: 'Südfenster', target: 'plant' }],
			photoIds: []
		});

		expect(currentAttrs(db).get('P-001')).toEqual({ Standort: 'Südfenster' });
		expect(attrHistory(db, 'P-001').Standort.map((h) => [h.value, h.since])).toEqual([
			['Ostfenster', null],
			['Südfenster', '2026-09-20']
		]);
		// The type learned that it sets "Standort" on the plant.
		expect(getType(db, type.id)?.fields).toEqual([{ key: 'Standort', target: 'plant' }]);

		db.prepare('DELETE FROM events WHERE id = ?').run(id);
		expect(currentAttrs(db).get('P-001')).toEqual({ Standort: 'Ostfenster' });
	});

	it('can mark the value before a backdated change as not recorded', () => {
		// The plant was entered with its current location, then an older move was added.
		plant('P-001', { Standort: 'Südfenster' });
		const type = ensureType(db, 'Standortwechsel');
		const move = (date: string, value: string, previous?: string | null) =>
			createEvents(db, ['P-001'], {
				typeId: type.id,
				date,
				note: '',
				fields: [{ key: 'Standort', value, target: 'plant', previous }],
				photoIds: []
			});

		move('2026-09-24', 'Südfenster', null);
		expect(attrHistory(db, 'P-001').Standort.map((h) => [h.value, h.since])).toEqual([
			['Südfenster', '2026-09-24']
		]);

		// An even older recorded change means the value before it is known: nothing removed.
		plant('P-002', { Standort: 'Ostfenster' });
		createEvents(db, ['P-002'], {
			typeId: type.id,
			date: '2026-03-01',
			note: '',
			fields: [{ key: 'Standort', value: 'Dachboden', target: 'plant' }],
			photoIds: []
		});
		createEvents(db, ['P-002'], {
			typeId: type.id,
			date: '2026-09-24',
			note: '',
			fields: [{ key: 'Standort', value: 'Südfenster', target: 'plant', previous: null }],
			photoIds: []
		});
		expect(attrHistory(db, 'P-002').Standort).toHaveLength(3);

		forgetInitialValue(db, 'P-002', 'Standort');
		expect(attrHistory(db, 'P-002').Standort.map((h) => h.value)).toEqual([
			'Dachboden',
			'Südfenster'
		]);
	});

	it('can set the known value before a backdated change', () => {
		plant('P-001', { Standort: 'Südfenster' });
		const type = ensureType(db, 'Standortwechsel');
		createEvents(db, ['P-001'], {
			typeId: type.id,
			date: '2026-09-24',
			note: '',
			fields: [{ key: 'Standort', value: 'Südfenster', target: 'plant', previous: 'Ostfenster' }],
			photoIds: []
		});
		const history = () => attrHistory(db, 'P-001').Standort.map((h) => [h.value, h.since]);
		expect(history()).toEqual([
			['Ostfenster', null],
			['Südfenster', '2026-09-24']
		]);

		// Directly on the plant: also adds an initial value where none was recorded.
		forgetInitialValue(db, 'P-001', 'Standort');
		setInitialValue(db, 'P-001', 'Standort', 'Dachboden');
		expect(history()).toEqual([
			['Dachboden', null],
			['Südfenster', '2026-09-24']
		]);
		expect(currentAttrs(db).get('P-001')).toEqual({ Standort: 'Südfenster' });
	});
});

describe('deleting a plant', () => {
	it('removes its events and photos, but not what other plants still use', () => {
		plant('P-001', { Standort: 'Küche' });
		plant('P-002');
		const type = ensureType(db, 'Umtopfen');
		for (const id of ['own', 'shared']) {
			db.prepare("INSERT INTO photos (id, file, mime) VALUES (?, ?, 'image/jpeg')").run(id, id);
		}
		const input = { typeId: type.id, note: '', fields: [] };
		createEvents(db, ['P-001'], { ...input, date: '2026-09-01', photoIds: ['own'] });
		const [, kept] = createEvents(db, ['P-001', 'P-002'], {
			...input,
			date: '2026-09-02',
			photoIds: ['shared']
		});

		expect(plantImpact(db, 'P-001')).toEqual({ events: 2, photos: 1 });
		deletePlant(db, 'P-001');

		expect(getPlant(db, 'P-001')).toBeUndefined();
		expect(db.prepare("SELECT count(*) AS n FROM events WHERE plant_id = 'P-001'").get()).toEqual({
			n: 0
		});
		expect(
			db.prepare("SELECT count(*) AS n FROM plant_attrs WHERE plant_id = 'P-001'").get()
		).toEqual({ n: 0 });
		expect(getEvent(db, kept)).toMatchObject({ plantId: 'P-002', photos: ['shared'] });
		const photos = db
			.prepare('SELECT id FROM photos')
			.all()
			.map((r) => r.id);
		expect(photos).toEqual(['shared']);
	});
});

describe('deleting event types and categories', () => {
	it('takes their events and photos along, and attributes fall back', () => {
		plant('P-001', { Standort: 'Küche' });
		db.prepare("INSERT INTO photos (id, file, mime) VALUES ('p', 'p', 'image/jpeg')").run();
		const move = ensureType(db, 'Umzug', { category: 'Pflege' });
		const water = ensureType(db, 'Gießen', { category: 'Pflege' });
		const bloom = ensureType(db, 'Blüte', { category: 'Beobachtung' });
		const input = { note: '', fields: [], photoIds: [] };
		createEvents(db, ['P-001'], {
			...input,
			typeId: move.id,
			date: '2026-09-01',
			fields: [{ key: 'Standort', value: 'Bad', target: 'plant' }],
			photoIds: ['p']
		});
		createEvents(db, ['P-001'], { ...input, typeId: water.id, date: '2026-09-02' });
		const [kept] = createEvents(db, ['P-001'], { ...input, typeId: bloom.id, date: '2026-09-03' });
		expect(currentAttrs(db).get('P-001')).toEqual({ Standort: 'Bad' });

		expect(typeImpact(db, water.id)).toEqual({ events: 1, photos: 0 });
		deleteType(db, water.id);
		expect(getType(db, water.id)).toBeUndefined();

		expect(categoryImpact(db, 'Pflege')).toEqual({ events: 1, photos: 1 });
		deleteCategory(db, 'Pflege');
		expect(getType(db, move.id)).toBeUndefined();
		expect(currentAttrs(db).get('P-001')).toEqual({ Standort: 'Küche' });
		expect(db.prepare('SELECT count(*) AS n FROM photos').get()).toEqual({ n: 0 });
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
		plant('P-001');
		const care = ensureType(db, 'Umtopfen', { category: 'Pflege' });
		const house = ensureType(db, 'Umtopfen', { category: 'Haus' });
		const water = ensureType(db, 'Gießen', { category: 'Haus' });
		const input = { note: '', fields: [], photoIds: [], date: '2026-09-01' };
		const [moved] = createEvents(db, ['P-001'], { ...input, typeId: house.id });

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
