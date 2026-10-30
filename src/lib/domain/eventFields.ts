import type { DiaryEvent, PropertyChange, RecordedField } from '../types.ts';

/**
 * The event's details and the changes it made to `objectId`. Without an object, each
 * changed name comes once, as an event sets the same value on all its objects.
 */
export function fieldsFor(
	event: Pick<DiaryEvent, 'fields'>,
	objectId: number | null
): RecordedField[] {
	const details = event.fields.filter((f) => f.target === 'event');
	const changes = event.fields.filter((f): f is PropertyChange => f.target === 'object');
	const shown =
		objectId === null
			? changes.filter((c, i) => changes.findIndex((d) => d.key === c.key) === i)
			: changes.filter((c) => c.objectId === objectId);
	return [...details, ...shown];
}
