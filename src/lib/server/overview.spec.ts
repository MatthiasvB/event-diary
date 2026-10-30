import { expect, it } from 'vitest';
import { openDiary } from './diarySchema.ts';
import { createEvent } from './events.ts';
import { ensureType } from './eventTypes.ts';
import { objectStats } from './overview.ts';
import { createObject } from './objects.ts';

it('shows as last event the one the timeline shows first, also on the same day', () => {
	const db = openDiary(':memory:');
	const id = createObject(db, { name: 'X', active: true, notes: '', attrs: [] });
	const water = ensureType(db, 'Gießen');
	const fertilize = ensureType(db, 'Düngen');
	const event = { note: '', fields: [], fileIds: [] };
	createEvent(db, [id], { ...event, typeId: fertilize.id, date: '2026-10-25' });
	createEvent(db, [id], { ...event, typeId: water.id, date: '2026-10-26' });
	createEvent(db, [id], { ...event, typeId: fertilize.id, date: '2026-10-26' });
	createEvent(db, [id], { ...event, typeId: water.id, date: '2026-10-01' });

	expect(objectStats(db, []).get(id)).toMatchObject({
		count: 4,
		last: { date: '2026-10-26', type: 'Düngen' }
	});
});
