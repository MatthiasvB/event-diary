import { describe, expect, it } from 'vitest';
import { formatDate, formatTypedDate, isValidDate } from './format.ts';

describe('formatTypedDate', () => {
	it('inserts separators while typing year, month, day', () => {
		expect(formatTypedDate('2')).toBe('2');
		expect(formatTypedDate('2026')).toBe('2026');
		expect(formatTypedDate('20261')).toBe('2026-1');
		expect(formatTypedDate('202610')).toBe('2026-10');
		expect(formatTypedDate('2026102')).toBe('2026-10-2');
		expect(formatTypedDate('20261025')).toBe('2026-10-25');
	});

	it('pads month and day digits that cannot start a two-digit number', () => {
		expect(formatTypedDate('20269')).toBe('2026-09');
		expect(formatTypedDate('2026095')).toBe('2026-09-05');
		expect(formatTypedDate('2026123')).toBe('2026-12-3');
	});

	it('reformats edited or pasted text and ignores extra digits', () => {
		expect(formatTypedDate('2026-')).toBe('2026');
		expect(formatTypedDate('2026-10-25')).toBe('2026-10-25');
		expect(formatTypedDate('2026-10-251')).toBe('2026-10-25');
		expect(formatTypedDate('')).toBe('');
	});
});

describe('isValidDate', () => {
	it('accepts real dates only', () => {
		expect(isValidDate('2026-10-25')).toBe(true);
		expect(isValidDate('2028-02-29')).toBe(true);
		expect(isValidDate('2026-02-29')).toBe(false);
		expect(isValidDate('2026-13-01')).toBe(false);
		expect(isValidDate('2026-10')).toBe(false);
	});
});

describe('formatDate', () => {
	it('shows dates as YYYY-MM-DD', () => {
		expect(formatDate('2026-09-13')).toBe('2026-09-13');
		expect(formatDate('2026-09-13T14:22:05')).toBe('2026-09-13');
		expect(formatDate(null)).toBe('');
	});
});
