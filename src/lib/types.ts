import type { Candidate } from './suggest.ts';

/** Where a field's value is stored: on the event, or as a (historized) plant attribute. */
export type FieldTarget = 'event' | 'plant';

export type Field = {
	key: string;
	value: string;
	target: FieldTarget;
	/**
	 * Plant fields only, when saving: the value before this change.
	 * Omitted: leave as is; null: not recorded; a string: that value.
	 */
	previous?: string | null;
};

/** A field an event type usually needs, optionally with a default value. */
export type FieldTemplate = { key: string; target: FieldTarget; default?: string };

export type EventType = {
	id: number;
	name: string;
	category: string;
	milestone: boolean;
	hint: string;
	fields: FieldTemplate[];
};

export type EventTypeStats = EventType & { count: number; last: string | null };

export type Plant = {
	id: string;
	name: string;
	active: boolean;
	acquiredOn: string | null;
	notes: string;
	coverPhotoId: string | null;
};

export type PlantAttr = {
	id: number;
	key: string;
	value: string;
	since: string | null;
	eventId: number | null;
};

export type DiaryEvent = {
	id: number;
	plantId: string;
	plantName: string;
	typeId: number;
	typeName: string;
	category: string;
	milestone: boolean;
	date: string;
	note: string;
	batchId: string | null;
	batchSize: number;
	fields: Field[];
	photos: string[];
};

export type ValueCandidate = Candidate & { byType: Record<number, number> };

/** Everything the typeahead fields need, loaded once per form. */
export type Vocabulary = {
	types: EventTypeStats[];
	categories: Candidate[];
	keys: Record<FieldTarget, ValueCandidate[]>;
	values: Record<string, ValueCandidate[]>;
};
