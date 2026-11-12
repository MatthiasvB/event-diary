import { describe, expect, it } from 'vitest';
import { displayValue, parseNumber, storedValue, TEXT, type FieldKind } from './fieldKinds.ts';

const cm: FieldKind = { kind: 'number', unit: 'cm' };
const date: FieldKind = { kind: 'date' };
const object: FieldKind = { kind: 'object' };
const names = (value: string) => ({ '7': 'Auto' })[value];

describe('field kinds', () => {
	it('reads numbers with comma or dot', () => {
		expect(parseNumber('12,5')).toBe(12.5);
		expect(parseNumber(' -3 ')).toBe(-3);
		expect(parseNumber('12 cm')).toBeNull();
	});

	it('stores numbers with a dot and keeps anything else as typed', () => {
		expect(storedValue('12,5', cm)).toBe('12.5');
		expect(storedValue('etwa 12', cm)).toBe('etwa 12');
		expect(storedValue('12,5', TEXT)).toBe('12,5');
	});

	it('shows numbers in German with their unit, dates as YYYY-MM-DD, objects by name', () => {
		expect(displayValue('1234.5', cm, names)).toBe('1.234,5 cm');
		expect(displayValue('etwa 12', cm, names)).toBe('etwa 12');
		expect(displayValue('2025-03-01', date, names)).toBe('2025-03-01');
		expect(displayValue('irgendwann', date, names)).toBe('irgendwann');
		expect(displayValue('12.5', TEXT, names)).toBe('12.5');
		expect(displayValue('7', object, names)).toBe('Auto');
		expect(displayValue('8', object, names)).toBe('8');
	});
});
