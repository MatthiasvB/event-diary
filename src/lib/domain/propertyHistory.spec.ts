import { describe, expect, it } from 'vitest';
import type { PropertyValue } from '../types.ts';
import { isFirstChange, replaced, unsaved } from './propertyHistory.ts';

const initial = (id: number, value: string): PropertyValue => ({
	id,
	key: 'Standort',
	value,
	since: null,
	eventId: null
});
const dated = (
	id: number,
	value: string,
	since: string,
	eventId: number | null = null
): PropertyValue => ({ id, key: 'Standort', value, since, eventId });

describe('the value a change replaces', () => {
	const history = [
		dated(4, 'Flur', '2026-07-01', 20),
		initial(1, 'Küche'),
		dated(2, 'Bad', '2026-05-01', 10),
		dated(3, 'Keller', '2026-05-01')
	];

	it('is the latest one before it, in any order of the history', () => {
		expect(replaced(history, { since: '2026-07-01', id: 4 })).toEqual({
			value: 'Keller',
			initial: false
		});
		expect(replaced(history, { since: '2026-05-01', id: 2 })).toEqual({
			value: 'Küche',
			initial: true
		});
	});

	it('for a change not saved yet, comes after everything on its date', () => {
		expect(replaced(history, unsaved('2026-05-01'))).toEqual({ value: 'Keller', initial: false });
		expect(replaced(history, unsaved(''))).toEqual({ value: 'Küche', initial: true });
	});

	it("leaves out the event's own values", () => {
		expect(replaced(history, unsaved('2026-08-01'), 20)).toEqual({
			value: 'Keller',
			initial: false
		});
	});

	it('is nothing without an earlier value, and then the change is the first', () => {
		const r = replaced([dated(2, 'Bad', '2026-05-01', 10)], unsaved('2026-04-01'));
		expect(r).toBeNull();
		expect(isFirstChange(r)).toBe(true);
		expect(isFirstChange({ value: 'Küche', initial: true })).toBe(true);
		expect(isFirstChange({ value: 'Bad', initial: false })).toBe(false);
	});
});
