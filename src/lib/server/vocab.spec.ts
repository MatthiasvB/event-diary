import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db.ts';
import { createEvents, getEvent } from './events.ts';
import { ensureType, getType } from './eventTypes.ts';
import { attrHistory, createPlant, currentAttrs } from './plants.ts';
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
});
