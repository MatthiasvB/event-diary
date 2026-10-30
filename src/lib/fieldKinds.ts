import { formatDate, isValidDate } from './format.ts';
import { locale } from './i18n.ts';

export const FIELD_KINDS = ['text', 'date', 'number'] as const;
export type FieldKindName = (typeof FIELD_KINDS)[number];
/** `unit` only applies to numbers, e.g. "cm" or "€". */
export type FieldKind = { kind: FieldKindName; unit: string };
export type FieldKinds = Record<string, FieldKind>;

export const TEXT: FieldKind = { kind: 'text', unit: '' };

export const FIELD_KINDS_DATA = 'diary:field-kinds';

export function kindOf(kinds: FieldKinds | undefined, key: string): FieldKind {
	return kinds?.[key] ?? TEXT;
}

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

export function parseNumber(value: string): number | null {
	const s = value.trim().replace(',', '.');
	return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

export function storedValue(value: string, kind: FieldKind): string {
	if (kind.kind !== 'number') return value;
	const n = parseNumber(value);
	return n === null ? value : String(n);
}

export function displayValue(value: string, kind: FieldKind): string {
	if (kind.kind === 'number') {
		const n = parseNumber(value);
		if (n !== null) return n.toLocaleString(locale) + (kind.unit ? ` ${kind.unit}` : '');
	}
	if (kind.kind === 'date' && isValidDate(value.slice(0, 10))) return formatDate(value);
	return value;
}
