// Kinds of values for properties and event details, set per name ("Angabe"). Plain text is
// the default. Values are always stored as text: dates as YYYY-MM-DD, numbers with a dot.
// A value that doesn't fit its kind is kept and shown as typed.
import { formatDate, isValidDate } from './format.ts';
import { locale } from './i18n.ts';

export const FIELD_KINDS = ['text', 'date', 'number'] as const;
export type FieldKindName = (typeof FIELD_KINDS)[number];
/** `unit` only applies to numbers, e.g. "cm" or "€". */
export type FieldKind = { kind: FieldKindName; unit: string };
/** Kinds by field name; names not listed are plain text. */
export type FieldKinds = Record<string, FieldKind>;

export const TEXT: FieldKind = { kind: 'text', unit: '' };

/** Dependency key of the diary's field kinds in its layout data, for invalidate(). */
export const FIELD_KINDS_DATA = 'diary:field-kinds';

export function kindOf(kinds: FieldKinds | undefined, key: string): FieldKind {
	return kinds?.[key] ?? TEXT;
}

/** A kind sent with a form ({ kind, unit }, or its JSON); undefined if it isn't one. */
export function parseKind(value: unknown): FieldKind | undefined {
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return undefined;
		}
	}
	const v = value as Partial<FieldKind> | null;
	const kind = FIELD_KINDS.find((k) => k === v?.kind);
	if (!kind) return undefined;
	return { kind, unit: kind === 'number' && typeof v?.unit === 'string' ? v.unit.trim() : '' };
}

/** "12,5", "12.5" or "-3" as a number; null if it isn't one. */
export function parseNumber(value: string): number | null {
	const s = value.trim().replace(',', '.');
	return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

/** The stored form of a value: numbers with a dot ("12,5" → "12.5"); others unchanged. */
export function storedValue(value: string, kind: FieldKind): string {
	if (kind.kind !== 'number') return value;
	const n = parseNumber(value);
	return n === null ? value : String(n);
}

/** How a value is shown: "12,5 cm" for numbers, YYYY-MM-DD for dates, text as is. */
export function displayValue(value: string, kind: FieldKind): string {
	if (kind.kind === 'number') {
		const n = parseNumber(value);
		if (n !== null) return n.toLocaleString(locale) + (kind.unit ? ` ${kind.unit}` : '');
	}
	if (kind.kind === 'date' && isValidDate(value.slice(0, 10))) return formatDate(value);
	return value;
}
