import { formatDate, isValidDate } from './format.ts';
import { locale } from './i18n.ts';

export const FIELD_KINDS = ['text', 'date', 'number'] as const;
export type FieldKindName = (typeof FIELD_KINDS)[number];
/** `unit` is e.g. "cm" or "€". */
export type FieldKind =
	{ kind: 'text' } | { kind: 'date' } | { kind: 'number'; unit: string | null };
export type FieldKinds = Record<string, FieldKind>;

export const TEXT: FieldKind = { kind: 'text' };

/** From a form: the kind's name and the unit typed for it. */
export function kindFrom(name: FieldKindName, unit: string): FieldKind {
	return name === 'number' ? { kind: name, unit: unit.trim() || null } : { kind: name };
}

export const unitOf = (kind: FieldKind) => (kind.kind === 'number' ? kind.unit : null);

/** What is chosen for a name used for the first time. */
export type NameChoice = { kind: FieldKind; suggest: boolean };

export function parseChoice(value: unknown): NameChoice | undefined {
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return undefined;
		}
	}
	const v = value as { kind?: unknown; suggest?: unknown } | null;
	const kind = parseKind(v?.kind);
	return kind && { kind, suggest: v?.suggest !== false };
}

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
	const v = value as { kind?: unknown; unit?: unknown } | null;
	const kind = FIELD_KINDS.find((k) => k === v?.kind);
	if (!kind) return undefined;
	return kindFrom(kind, typeof v?.unit === 'string' ? v.unit : '');
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
