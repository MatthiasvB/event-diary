import { page } from '$app/state';
import { displayValue, kindOf, type FieldKinds } from './fieldKinds.ts';

export function fieldKind(key: string) {
	return kindOf(page.data.fieldKinds as FieldKinds | undefined, key);
}

export function suggestsValues(key: string) {
	return !(page.data.withoutSuggestions as string[] | undefined)?.includes(key.trim());
}

export function showValue(key: string, value: string) {
	return displayValue(value, fieldKind(key));
}
