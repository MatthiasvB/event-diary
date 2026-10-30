import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../i18n.ts';
import { openDb } from './db.ts';
import { Diary, view, type EventEntry } from './testing/harness.ts';

let d: Diary;

beforeEach(() => {
	d = new Diary(openDb(':memory:'));
});

const timeline = (name: string) => d.show(name).timeline;
const history = (name: string, key: string) => d.show(name).properties[key];
const type = (label: string) => view(d.db).types.find((ty) => ty.type === label);

describe('editing an event', () => {
	const fertilize = { type: 'Düngen', date: '2026-03-01', details: { Produkt: 'Blau' } };

	it('changes its whole batch only when asked', () => {
		d.object('A');
		d.object('B');
		d.record({ ...fertilize, objects: ['A', 'B'], note: 'halbe Dosis' });

		d.edit(d.event('A', '2026-03-01', 'Düngen'), {
			...fertilize,
			objects: ['A'],
			note: 'volle Dosis'
		});
		expect(timeline('A').map((e) => e.note)).toEqual(['volle Dosis']);
		expect(timeline('B').map((e) => e.note)).toEqual(['halbe Dosis']);

		d.edit(d.event('B', '2026-03-01', 'Düngen'), {
			...fertilize,
			objects: ['B'],
			note: 'Rest',
			details: { Produkt: 'Rot' },
			applyToBatch: true
		});
		for (const name of ['A', 'B']) {
			expect(timeline(name).map((e) => [e.objects, e.note, e.details])).toEqual([
				[['A', 'B'], 'Rest', { Produkt: 'Rot' }]
			]);
		}
	});

	it('moves to another object with the property it changes', () => {
		d.object('A', { properties: { Standort: 'Küche' } });
		d.object('B', { properties: { Standort: 'Flur' } });
		const move: EventEntry = {
			objects: ['A'],
			type: 'Umzug',
			date: '2026-05-01',
			changes: { Standort: 'Bad' }
		};
		d.record(move);
		d.edit(d.event('A', '2026-05-01', 'Umzug'), { ...move, objects: ['B'] });

		expect(timeline('A')).toEqual([]);
		expect(history('A', 'Standort')).toEqual([{ value: 'Küche', since: null, by: null }]);
		expect(history('B', 'Standort')).toEqual([
			{ value: 'Flur', since: null, by: null },
			{ value: 'Bad', since: '2026-05-01', by: '2026-05-01 Umzug' }
		]);
	});

	it('moves the property change along with its date', () => {
		d.object('A', { properties: { Standort: 'Küche' } });
		const move = (date: string, place: string): EventEntry => ({
			objects: ['A'],
			type: 'Umzug',
			date,
			changes: { Standort: place }
		});
		d.record(move('2026-05-01', 'Bad'));
		d.record(move('2026-07-01', 'Flur'));
		d.edit(d.event('A', '2026-05-01', 'Umzug'), move('2026-08-01', 'Bad'));

		expect(history('A', 'Standort').map((h) => [h.value, h.since])).toEqual([
			['Küche', null],
			['Flur', '2026-07-01'],
			['Bad', '2026-08-01']
		]);
		expect(timeline('A').map((e) => [e.event, e.changes[0].before, e.changes[0].first])).toEqual([
			['2026-08-01 Umzug', 'Flur', false],
			['2026-07-01 Umzug', 'Küche', true]
		]);
	});

	it('deletes the files no event uses any more, and the cover falls back', () => {
		d.object('A');
		d.object('B');
		for (const name of ['a.jpg', 'b.jpg', 'shared.jpg']) d.file(name);
		const photos = (date: string, objects: string[], files: string[]): EventEntry => ({
			objects,
			type: 'Foto',
			date,
			files
		});
		d.record(photos('2026-03-01', ['A'], ['a.jpg', 'b.jpg']));
		d.record(photos('2026-04-01', ['A', 'B'], ['shared.jpg']));
		expect(d.show('A').cover).toBe('a.jpg');

		d.edit(d.event('A', '2026-03-01', 'Foto'), photos('2026-03-01', ['A'], ['b.jpg']));
		d.edit(d.event('A', '2026-04-01', 'Foto'), photos('2026-04-01', ['A'], []));

		expect(view(d.db).storedFiles).toEqual(['b.jpg', 'shared.jpg']);
		expect(d.show('A').cover).toBe('b.jpg');
		expect(timeline('B').map((e) => e.files)).toEqual([['shared.jpg']]);
	});
});

describe('editing an object', () => {
	it('corrects a value entered on the object in place', () => {
		d.object('A', { properties: { Standort: 'Küche' } });
		d.editObject('A', { properties: { Standort: 'Bad' } });
		expect(history('A', 'Standort')).toEqual([{ value: 'Bad', since: null, by: null }]);
	});

	it('starts a new value today when the current one came from an event', () => {
		d.object('A', { properties: { Standort: 'Küche' } });
		d.record({ objects: ['A'], type: 'Umzug', date: '2026-05-01', changes: { Standort: 'Bad' } });
		d.editObject('A', { properties: { Standort: 'Flur' } });
		expect(history('A', 'Standort')).toEqual([
			{ value: 'Küche', since: null, by: null },
			{ value: 'Bad', since: '2026-05-01', by: '2026-05-01 Umzug' },
			{ value: 'Flur', since: d.today, by: null }
		]);
	});

	it('removes a value entered on the object, but not one set by an event', () => {
		d.object('A', { properties: { Standort: 'Küche', Substrat: 'Moos' } });
		d.record({
			objects: ['A'],
			type: 'Umtopfen',
			date: '2026-05-01',
			changes: { Substrat: 'Rinde' }
		});
		d.editObject('A', {});
		expect(d.show('A').properties).toEqual({
			Substrat: [
				{ value: 'Moos', since: null, by: null },
				{ value: 'Rinde', since: '2026-05-01', by: '2026-05-01 Umtopfen' }
			]
		});
	});

	it('renames it and sets it inactive', () => {
		d.object('A', { notes: 'alt' });
		d.editObject('A', { name: 'B', active: false, notes: 'neu' });
		expect(view(d.db).objects.map((o) => [o.name, o.active, o.notes])).toEqual([
			['B', false, 'neu']
		]);
	});
});

describe('the forms', () => {
	it('store numbers with a dot, and a kind only for a name not used yet', () => {
		const number = { kind: 'number', unit: 'cm' } as const;
		d.object('A', { properties: { Topfgröße: '12,5' }, kinds: { Topfgröße: number } });
		d.object('B', {
			properties: { Topfgröße: '9' },
			kinds: { Topfgröße: { kind: 'date', unit: '' } }
		});
		d.record({
			objects: ['A'],
			type: 'Düngen',
			date: '2026-03-01',
			details: { Menge: '2,5' },
			kinds: { Menge: { kind: 'number', unit: 'ml' } }
		});

		expect(view(d.db).kinds).toEqual({ Menge: { kind: 'number', unit: 'ml' }, Topfgröße: number });
		expect(history('A', 'Topfgröße')[0].value).toBe('12.5');
		expect(timeline('A')[0].details).toEqual({ Menge: '2.5' });
	});

	it("record a property's name as a change, even when sent as a detail", () => {
		d.object('A', { properties: { Standort: 'Küche' } });
		d.record({
			objects: ['A'],
			type: 'Umzug',
			date: '2026-05-01',
			details: { Standort: 'Bad', Grund: 'Licht' }
		});
		expect(timeline('A').map((e) => [e.details, e.changes])).toEqual([
			[{ Grund: 'Licht' }, [{ key: 'Standort', value: 'Bad', before: 'Küche', first: true }]]
		]);
	});

	it('turn earlier details into changes when a name is sent as a change', () => {
		d.object('A');
		d.record({ objects: ['A'], type: 'Gießen', date: '2026-01-10', details: { Wasser: 'Regen' } });
		d.record({
			objects: ['A'],
			type: 'Gießen',
			date: '2026-02-10',
			changes: { Wasser: 'Leitung' }
		});
		expect(history('A', 'Wasser')).toEqual([
			{ value: 'Regen', since: '2026-01-10', by: '2026-01-10 Gießen' },
			{ value: 'Leitung', since: '2026-02-10', by: '2026-02-10 Gießen' }
		]);
		expect(type('Gießen')?.fields).toEqual([{ key: 'Wasser', target: 'object' }]);
	});

	it('keep, forget or set the value before a first change', () => {
		for (const name of ['Keep', 'Forget', 'Set']) {
			d.object(name, { properties: { Substrat: 'Moos' } });
		}
		const repot = (name: string, change: EventEntry['changes']) =>
			d.record({ objects: [name], type: 'Umtopfen', date: '2026-05-01', changes: change });
		repot('Keep', { Substrat: 'Rinde' });
		repot('Forget', { Substrat: { value: 'Rinde', before: null } });
		repot('Set', { Substrat: { value: 'Rinde', before: 'Erde' } });

		const values = (name: string) => history(name, 'Substrat').map((h) => h.value);
		expect(values('Keep')).toEqual(['Moos', 'Rinde']);
		expect(values('Forget')).toEqual(['Rinde']);
		expect(values('Set')).toEqual(['Erde', 'Rinde']);
	});

	it('refuse events without objects, a type or a real date', () => {
		d.object('A');
		const event = { objects: ['A'], type: 'Düngen', date: '2026-05-01' };
		expect(() => d.record({ ...event, objects: [] })).toThrow(t.events.noObjects);
		expect(() => d.record({ ...event, type: '' })).toThrow(t.events.noType);
		expect(() => d.record({ ...event, date: '2026-02-30' })).toThrow(t.events.badDate);
	});
});

describe('event types', () => {
	const fertilize = (date: string, details: Record<string, string>) =>
		d.record({ objects: ['A'], type: 'Düngen', date, details });

	it('learn the fields they are used with, in the order they first appear', () => {
		d.object('A');
		fertilize('2026-03-01', { Produkt: 'Blau' });
		fertilize('2026-04-01', { Menge: '2', Produkt: 'Blau' });
		expect(type('Düngen')?.fields).toEqual([
			{ key: 'Produkt', target: 'event' },
			{ key: 'Menge', target: 'event' }
		]);
	});

	it('are prefilled from the latest event by date, not the one entered last', () => {
		d.object('A');
		fertilize('2026-05-01', { Produkt: 'Blau' });
		fertilize('2026-03-01', { Produkt: 'Rot' });
		expect(view(d.db).lastFields).toEqual({
			Düngen: [{ key: 'Produkt', value: 'Blau', target: 'event' }]
		});
	});

	it('keep defaults in the form of their kind', () => {
		d.object('A');
		fertilize('2026-03-01', {});
		const saved = d.saveType('Düngen', {
			fields: [{ key: 'Menge', default: '2,5', kind: { kind: 'number', unit: 'ml' } }]
		});
		expect(saved).toBe(true);
		expect(type('Düngen')?.fields).toEqual([{ key: 'Menge', target: 'event', default: '2.5' }]);
	});
});

describe('a new object with photos', () => {
	it('gets a photo event on their date, and the first photo as cover', () => {
		d.file('a.jpg');
		d.file('b.jpg');
		d.object('A', {}, { files: ['a.jpg', 'b.jpg'], date: '2026-02-03' });
		expect(d.show('A').cover).toBe('a.jpg');
		expect(timeline('A').map((e) => [e.event, e.files])).toEqual([
			[`2026-02-03 ${t.events.photoTypeCategory}/${t.events.photoType}`, ['a.jpg', 'b.jpg']]
		]);
	});
});
