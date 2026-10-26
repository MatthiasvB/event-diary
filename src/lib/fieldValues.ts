// Field kinds of the current diary (from its layout data), for input and display.
import { page } from '$app/state';
import { displayValue, kindOf, type FieldKinds } from './fieldKinds.ts';

/** The kind of a field name in the current diary; plain text unless set. */
export function fieldKind(key: string) {
	return kindOf(page.data.fieldKinds as FieldKinds | undefined, key);
}

/** A value as shown in the current diary, e.g. "12,5 cm". */
export function showValue(key: string, value: string) {
	return displayValue(value, fieldKind(key));
}
