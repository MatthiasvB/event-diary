import { expect, it } from 'vitest';
import { openDb } from './db.ts';
import { createEvents, listEvents } from './events.ts';
import { ensureType } from './eventTypes.ts';
import { createPlant } from './plants.ts';

it('searches event type names and notes, ignoring case and umlauts', () => {
	const db = openDb(':memory:');
	for (const id of ['P-001', 'P-002']) {
		createPlant(db, { id, name: id, active: true, notes: '', attrs: [] });
	}
	const log = ensureType(db, 'Log', { category: 'Sonstiges' });
	const fertilize = ensureType(db, 'Düngen');
	const add = (plant: string, typeId: number, note: string) =>
		createEvents(db, [plant], { typeId, date: '2026-10-26', note, fields: [], fileIds: [] })[0];
	const cellar = add('P-001', log.id, 'Kellerdecke betoniert, Lüftung verlegt');
	const fed = add('P-001', fertilize.id, '');
	const other = add('P-002', log.id, 'Lüftungsrohr im Bad zersägt');

	const ids = (search: string, plantId?: string) =>
		listEvents(db, { search, plantId }).map((e) => e.id);
	expect(ids('duengen')).toEqual([fed]);
	expect(ids('LÜFTUNG')).toEqual([other, cellar]);
	expect(ids('luftung keller')).toEqual([cellar]);
	expect(ids('lüftung', 'P-002')).toEqual([other]);
	expect(ids('log bad')).toEqual([other]);
	expect(ids('garage')).toEqual([]);
	expect(ids('  ')).toHaveLength(3);
});
