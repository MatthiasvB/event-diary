import { beforeEach, describe, expect, it } from 'vitest';
import { formatTarget } from '../domain/associations.ts';
import { formatDate } from '../format.ts';
import { t } from '../i18n.ts';
import { openDiary } from './diarySchema.ts';
import { Diary, view, type EventEntry } from './testing/harness.ts';

let d: Diary;

beforeEach(() => {
	d = new Diary(openDiary(':memory:'));
});

const timeline = (name: string) => d.show(name).timeline;
const history = (name: string, key: string) => d.show(name).properties[key];
const type = (label: string) => view(d.db).types.find((ty) => ty.type === label);

describe('editing an event', () => {
	const fertilize = { type: 'Düngen', date: '2026-03-01', details: { Produkt: 'Blau' } };

	it('changes for all its objects when asked, or for one, which then leaves it', () => {
		d.object('A');
		d.object('B');
		d.object('C');
		d.record({ ...fertilize, objects: ['A', 'B', 'C'], note: 'halbe Dosis' });

		d.edit(d.event('B', '2026-03-01', 'Düngen'), {
			...fertilize,
			objects: ['B'],
			note: 'Rest',
			details: { Produkt: 'Rot' },
			applyToBatch: true
		});
		for (const name of ['A', 'B', 'C']) {
			expect(timeline(name).map((e) => [e.objects, e.note, e.details])).toEqual([
				[['A', 'B', 'C'], 'Rest', { Produkt: 'Rot' }]
			]);
		}

		d.edit(d.event('A', '2026-03-01', 'Düngen'), {
			...fertilize,
			objects: ['A'],
			note: 'volle Dosis'
		});
		expect(timeline('A').map((e) => [e.objects, e.note])).toEqual([[['A'], 'volle Dosis']]);
		expect(timeline('B').map((e) => [e.objects, e.note])).toEqual([[['B', 'C'], 'Rest']]);
		expect(type('Düngen')?.count).toBe(2);
	});

	it('keeps a change for each of its objects, and drops one with its object', () => {
		d.object('A', { properties: { Standort: 'Küche' } });
		d.object('B', { properties: { Standort: 'Flur' } });
		const move = { type: 'Umzug', date: '2026-05-01', changes: { Standort: 'Bad' } };
		d.record({ ...move, objects: ['A', 'B'] });
		expect(timeline('A')[0].changes).toEqual([
			{ key: 'Standort', value: 'Bad', before: 'Küche', first: true }
		]);
		expect(timeline('B')[0].changes).toEqual([
			{ key: 'Standort', value: 'Bad', before: 'Flur', first: true }
		]);

		d.record({ objects: ['B'], type: 'Gießen', date: '2026-05-02' });
		d.delete('B');
		expect(timeline('A').map((e) => e.objects)).toEqual([['A']]);
		expect(history('A', 'Standort').map((h) => h.value)).toEqual(['Küche', 'Bad']);
		expect(type('Gießen')?.count).toBe(0);
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
			kinds: { Topfgröße: { kind: 'date' } }
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

describe('fields', () => {
	it('become properties with their earlier values when a type sets them on the object', () => {
		d.object('A');
		d.record({ objects: ['A'], type: 'Umtopfen', date: '2026-03-01', details: { Topf: 'Ton' } });
		d.saveType('Umtopfen', { fields: [{ key: 'Topf', target: 'object' }] });
		expect(history('A', 'Topf')).toEqual([
			{ value: 'Ton', since: '2026-03-01', by: '2026-03-01 Umtopfen' }
		]);
		expect(timeline('A')[0].details).toEqual({});
	});

	it('stay properties once their values are gone', () => {
		d.object('A', { properties: { Standort: 'Küche' } });
		d.editObject('A', {});
		expect(view(d.db).vocabulary.keys.object.map((k) => k.value)).toEqual(['Standort']);

		d.record({ objects: ['A'], type: 'Umzug', date: '2026-05-01', details: { Standort: 'Bad' } });
		expect(timeline('A')[0].changes).toEqual([
			{ key: 'Standort', value: 'Bad', before: null, first: true }
		]);
	});
});

describe('suggestions', () => {
	it('can be turned off for a new name right where it is entered', () => {
		d.object('A', { properties: { Preis: '8 €' }, withoutSuggestions: ['Preis'] });
		d.record({
			objects: ['A'],
			type: 'Kauf',
			date: '2026-05-01',
			details: { Händler: 'Gärtnerei', Rabatt: '10 %' },
			withoutSuggestions: ['Rabatt']
		});
		d.saveType('Kauf', { fields: [{ key: 'Beleg', suggest: false }] });
		expect(view(d.db).withoutSuggestions).toEqual(['Beleg', 'Preis', 'Rabatt']);
	});

	it('can be turned off for a name, which keeps its values for maintenance', () => {
		d.object('A', { properties: { Preis: '8 €' } });
		expect(view(d.db).withoutSuggestions).toEqual([]);

		d.suggestions('Preis', false);
		d.rename({ kind: 'key' }, 'Preis', 'Kaufpreis');
		const { withoutSuggestions, vocabulary } = view(d.db);
		expect(withoutSuggestions).toEqual(['Kaufpreis']);
		expect(vocabulary.values.Kaufpreis.map((v) => v.value)).toEqual(['8 €']);
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

describe('associations', () => {
	const IN = { In: { kind: 'object' } } as const;

	it('point to objects with a history, by the names they have now', () => {
		d.object('Auto', { listed: false });
		d.object('Schrank');
		d.object('Fernbedienung', { properties: { In: d.ref('Schrank') }, kinds: IN });
		d.record({
			objects: ['Fernbedienung'],
			type: 'Mitgenommen',
			date: '2026-05-01',
			changes: { In: d.ref('Auto') }
		});
		d.editObject('Auto', { name: 'Kombi', listed: false });

		expect(history('Fernbedienung', 'In')).toEqual([
			{ value: 'Schrank', since: null, by: null },
			{ value: 'Kombi', since: '2026-05-01', by: '2026-05-01 Mitgenommen' }
		]);
		expect(timeline('Fernbedienung')[0].changes).toEqual([
			{ key: 'In', value: 'Kombi', before: 'Schrank', first: true }
		]);
		expect(d.show('Kombi').listed).toBe(false);
	});

	it('create an object named in the form, which stays off the start page', () => {
		d.object('Akku', { properties: { In: formatTarget({ name: 'Ladegerät' }) }, kinds: IN });
		expect(history('Akku', 'In')).toEqual([{ value: 'Ladegerät', since: null, by: null }]);
		expect(d.show('Ladegerät').listed).toBe(false);
	});

	it('make a property of a new name, even when sent as a detail', () => {
		d.object('Auto');
		d.object('A');
		d.record({
			objects: ['A'],
			type: 'Ausflug',
			date: '2026-05-01',
			details: { Mit: d.ref('Auto') },
			kinds: { Mit: { kind: 'object' } }
		});
		expect(timeline('A')[0].changes).toEqual([
			{ key: 'Mit', value: 'Auto', before: null, first: true }
		]);
	});

	it('refuse a loop, also through several objects, and save nothing of it', () => {
		d.object('Schrank');
		d.object('Kiste', { properties: { In: d.ref('Schrank') }, kinds: IN });
		d.object('Akku', { properties: { In: d.ref('Kiste') } });

		expect(() => d.editObject('Schrank', { properties: { In: d.ref('Akku') } })).toThrow(
			t.associations.cycle
		);
		expect(() => d.editObject('Schrank', { properties: { In: d.ref('Schrank') } })).toThrow(
			t.associations.cycle
		);
		const move = { objects: ['Schrank'], type: 'Umzug', date: '2026-05-01' };
		expect(() =>
			d.record({ ...move, changes: { In: formatTarget({ name: 'Keller' }) } })
		).not.toThrow();
		expect(() => d.record({ ...move, changes: { In: d.ref('Kiste') } })).toThrow(
			t.associations.cycle
		);
		expect(timeline('Schrank').map((e) => e.changes)).toEqual([
			[{ key: 'In', value: 'Keller', before: null, first: true }]
		]);
	});

	it('can be added from the holder, for several objects at once', () => {
		d.object('Schrank');
		d.object('Regal', { properties: { In: d.ref('Schrank') }, kinds: IN });
		d.object('A');
		d.object('B');
		d.record({
			objects: ['B'],
			type: 'Umzug',
			date: '2026-05-01',
			changes: { In: d.ref('Schrank') }
		});

		d.associate('Regal', 'In', ['A', 'B']);
		expect(history('A', 'In')).toEqual([{ value: 'Regal', since: null, by: null }]);
		expect(history('B', 'In')).toEqual([
			{ value: 'Schrank', since: '2026-05-01', by: '2026-05-01 Umzug' },
			{ value: 'Regal', since: '2026-10-30', by: null }
		]);
		expect(() => d.associate('A', 'In', ['Schrank'])).toThrow(t.associations.cycle);
		expect(() => d.associate('Regal', 'Farbe', ['B'])).toThrow(t.errors.generic);
	});

	it('keep an object from being deleted while anything points to it', () => {
		d.object('Schrank');
		d.object('Kiste', { properties: { In: d.ref('Schrank') }, kinds: IN });
		expect(() => d.delete('Schrank')).toThrow(/Kiste/);
		d.delete('Kiste');
		d.delete('Schrank');
		expect(view(d.db).objects).toEqual([]);
	});

	it('come from a text property, whose values become objects, and back', () => {
		d.object('Fensterbank');
		d.object('A', { properties: { Standort: 'Fensterbank' } });
		d.object('B', { properties: { Standort: 'Regal' } });

		d.kind('Standort', { kind: 'object' });
		expect(view(d.db).objects.map((o) => [o.name, o.listed])).toEqual([
			['A', true],
			['B', true],
			['Fensterbank', true],
			['Regal', false]
		]);
		d.editObject('Fensterbank', { name: 'Ostfenster' });
		expect(history('A', 'Standort')).toEqual([{ value: 'Ostfenster', since: null, by: null }]);

		d.kind('Standort', { kind: 'text' });
		expect(history('A', 'Standort')).toEqual([{ value: 'Ostfenster', since: null, by: null }]);
		expect(view(d.db).kinds).toEqual({});
	});
});

describe('stock', () => {
	const stockIn = (holders: Record<string, number>) => ({ along: 'In', holders });
	const units = (stock: string) => d.show(stock).stock?.holders;
	const swap = { objects: ['Fernbedienung'], type: 'Akkus gewechselt' };

	beforeEach(() => {
		d.object('Schrank', { listed: false });
		d.object('Ladegerät', {
			properties: { In: d.ref('Schrank') },
			kinds: { In: { kind: 'object' } }
		});
		d.object('Fernbedienung');
		d.object('Eneloop', { stock: 'In' });
		d.moveUnits({ stock: 'Eneloop', quantity: 16, from: null, to: 'Schrank' });
		d.moveUnits({
			stock: 'Eneloop',
			quantity: 4,
			from: 'Schrank',
			to: 'Ladegerät',
			date: '2026-03-01'
		});
	});

	it('is counted where its units are, and moves with events', () => {
		expect(d.show('Eneloop').stock).toEqual(stockIn({ Ladegerät: 4, Schrank: 12 }));
		d.record({
			...swap,
			date: '2026-04-01',
			moves: [{ stock: 'Eneloop', quantity: 2, from: 'Ladegerät', to: 'Fernbedienung' }]
		});
		expect(units('Eneloop')).toEqual({ Fernbedienung: 2, Ladegerät: 2, Schrank: 12 });

		const { event } = d.event('Eneloop', '2026-04-01', 'Akkus gewechselt');
		expect(event.objects.map((o) => o.name)).toEqual(['Fernbedienung']);
		expect(event.moves.map((m) => [m.quantity, m.stock.name, m.from?.name, m.to?.name])).toEqual([
			[2, 'Eneloop', 'Ladegerät', 'Fernbedienung']
		]);

		d.edit(d.event('Fernbedienung', '2026-04-01', 'Akkus gewechselt'), {
			...swap,
			date: '2026-04-01',
			moves: [{ stock: 'Eneloop', quantity: 2, from: 'Ladegerät', to: null }]
		});
		expect(units('Eneloop')).toEqual({ Ladegerät: 2, Schrank: 12 });
		d.deleteEvent(d.event('Fernbedienung', '2026-04-01', 'Akkus gewechselt').event.id);
		expect(units('Eneloop')).toEqual({ Ladegerät: 4, Schrank: 12 });
	});

	it('refuses to leave an object short of units, also on an earlier day', () => {
		const short = (holder: string, date: string | null) =>
			t.units.shortfall('Eneloop', holder, date && formatDate(date));
		const toRemote = { stock: 'Eneloop', from: 'Ladegerät', to: 'Fernbedienung' } as const;

		expect(() => d.moveUnits({ ...toRemote, quantity: 5, date: '2026-04-01' })).toThrow(
			short('Ladegerät', '2026-04-01')
		);
		expect(() =>
			d.record({ ...swap, date: '2026-02-01', moves: [{ ...toRemote, quantity: 1 }] })
		).toThrow(short('Ladegerät', '2026-02-01'));
		expect(timeline('Fernbedienung')).toEqual([]);

		d.record({ ...swap, date: '2026-04-01', moves: [{ ...toRemote, quantity: 4 }] });
		expect(() => d.removeLastMove('Eneloop')).toThrow(short('Ladegerät', '2026-04-01'));
		expect(() =>
			d.moveUnits({ stock: 'Eneloop', quantity: 1, from: 'Schrank', to: 'Schrank' })
		).toThrow(t.units.sameHolder);
		expect(units('Eneloop')).toEqual({ Fernbedienung: 4, Schrank: 12 });

		const bought = { objects: ['Eneloop'], type: 'Gekauft', date: '2026-05-01' };
		d.record({ ...bought, moves: [{ stock: 'Eneloop', quantity: 2, from: null, to: 'Schrank' }] });
		d.moveUnits({ stock: 'Eneloop', quantity: 14, from: 'Schrank', to: null, date: '2026-06-01' });
		expect(() => d.deleteEvent(d.event('Eneloop', '2026-05-01', 'Gekauft').event.id)).toThrow(
			short('Schrank', '2026-06-01')
		);
		expect(units('Eneloop')).toEqual({ Fernbedienung: 4 });
	});

	it('rolls up along the association, and follows a rename of it', () => {
		d.moveUnits({ stock: 'Eneloop', quantity: 1, from: 'Schrank', to: 'Fernbedienung' });
		d.rename({ kind: 'key' }, 'In', 'Ort');
		expect(d.show('Eneloop').stock).toEqual({
			along: 'Ort',
			holders: { Fernbedienung: 1, Ladegerät: 4, Schrank: 11 }
		});
		expect(history('Ladegerät', 'Ort')).toEqual([{ value: 'Schrank', since: null, by: null }]);
	});

	it('keeps stock and items apart', () => {
		expect(() =>
			d.editObject('Eneloop', { stock: 'In', properties: { In: d.ref('Schrank') } })
		).toThrow(t.units.noAssociations);
		expect(() => d.editObject('Eneloop', {})).toThrow(t.units.locked);
		expect(() => d.editObject('Schrank', { listed: false, stock: 'In' })).toThrow(t.units.locked);
		d.object('Blume', { properties: { Farbe: 'blau' } });
		expect(() => d.object('Farben', { stock: 'Farbe' })).toThrow(t.units.notAnAssociation('Farbe'));
		expect(() => d.object('Farben', { stock: 'Neu', properties: { Neu: 'x' } })).toThrow(
			t.units.noAssociations
		);
		expect(() => d.kind('In', { kind: 'text' })).toThrow(t.units.spreadAlong('In', ['Eneloop']));

		d.object('Kiste', { properties: { In: d.ref('Eneloop') } });
		expect(history('Kiste', 'In')).toBeUndefined();
		expect(() => d.associate('Eneloop', 'In', ['Kiste'])).toThrow(t.errors.generic);

		expect(() => d.delete('Schrank')).toThrow(/Eneloop/);
		d.delete('Eneloop');
		d.delete('Ladegerät');
		d.delete('Schrank');
	});
});
