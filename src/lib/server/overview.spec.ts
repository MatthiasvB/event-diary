import { expect, it } from 'vitest';
import { openDb } from './db.ts';
import { createEvents } from './events.ts';
import { ensureType } from './eventTypes.ts';
import { plantStats } from './overview.ts';
import { createPlant } from './plants.ts';

it('shows as last event the one the timeline shows first, also on the same day', () => {
	const db = openDb(':memory:');
	createPlant(db, { id: 'P-001', name: 'X', active: true, acquiredOn: null, notes: '', attrs: [] });
	const water = ensureType(db, 'Gießen');
	const fertilize = ensureType(db, 'Düngen');
	const event = { note: '', fields: [], fileIds: [] };
	createEvents(db, ['P-001'], { ...event, typeId: fertilize.id, date: '2026-10-25' });
	createEvents(db, ['P-001'], { ...event, typeId: water.id, date: '2026-10-26' });
	createEvents(db, ['P-001'], { ...event, typeId: fertilize.id, date: '2026-10-26' });
	createEvents(db, ['P-001'], { ...event, typeId: water.id, date: '2026-10-01' });

	expect(plantStats(db, []).get('P-001')).toMatchObject({
		count: 4,
		last: { date: '2026-10-26', type: 'Düngen' }
	});
});
