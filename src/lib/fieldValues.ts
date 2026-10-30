import { page } from '$app/state';
import { displayValue, kindOf, type FieldKinds } from './fieldKinds.ts';

export function fieldKind(key: string) {
	return kindOf(page.data.fieldKinds as FieldKinds | undefined, key);
}

export function showValue(key: string, value: string) {
	return displayValue(value, fieldKind(key));
}
