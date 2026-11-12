import { page } from '$app/state';
import { targetName } from './domain/associations.ts';
import { displayValue, kindOf, type FieldKinds } from './fieldKinds.ts';

export function fieldKind(key: string) {
	return kindOf(page.data.fieldKinds as FieldKinds | undefined, key);
}

export function suggestsValues(key: string) {
	return !(page.data.withoutSuggestions as string[] | undefined)?.includes(key.trim());
}

export function objectName(id: number): string | undefined {
	return (page.data.objectNames as Record<number, string> | undefined)?.[id];
}

export function showValue(key: string, value: string) {
	return displayValue(value, fieldKind(key), (v) => targetName(v, objectName));
}
