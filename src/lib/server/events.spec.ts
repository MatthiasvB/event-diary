import { expect, it } from 'vitest';
import { openDiary } from './diarySchema.ts';
import { createEvents, listEvents } from './events.ts';
import { ensureType } from './eventTypes.ts';
import { createObject } from './objects.ts';

it('searches event type names and notes, ignoring case and umlauts', () => {
	const db = openDiary(':memory:');
	for (const name of ['A', 'B']) {
		createObject(db, { name, active: true, notes: '', attrs: [] });
	}
	const log = ensureType(db, 'Log', { category: 'Sonstiges' });
	const fertilize = ensureType(db, 'Düngen');
	const add = (object: number, typeId: number, note: string) =>
		createEvents(db, [object], { typeId, date: '2026-10-26', note, fields: [], fileIds: [] })[0];
	const cellar = add(1, log.id, 'Kellerdecke betoniert, Lüftung verlegt');
	const fed = add(1, fertilize.id, '');
	const other = add(2, log.id, 'Lüftungsrohr im Bad zersägt');

	const ids = (search: string, objectId?: number) =>
		listEvents(db, { search, objectId }).map((e) => e.id);
	expect(ids('duengen')).toEqual([fed]);
	expect(ids('LÜFTUNG')).toEqual([other, cellar]);
	expect(ids('luftung keller')).toEqual([cellar]);
	expect(ids('lüftung', 2)).toEqual([other]);
	expect(ids('log bad')).toEqual([other]);
	expect(ids('garage')).toEqual([]);
	expect(ids('  ')).toHaveLength(3);
});
