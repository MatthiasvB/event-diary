import type { FieldKind } from './fieldKinds.ts';
import type { EventFile } from './files.ts';

import type { Candidate } from './suggest.ts';

export type FieldTarget = 'event' | 'object';

export type Field = {
	key: string;
	value: string;
	target: FieldTarget;
	/**
	 * Object fields only, when saving: the value before this change.
	 * Omitted: leave as is; null: not recorded; a string: that value.
	 */
	previous?: string | null;
	/** A name used for the first time: the kind of its values, chosen while entering it. */
	kind?: FieldKind;
	/** Object fields of a saved event: the value the change replaced (null: not recorded). */
	before?: string | null;
	/** Object fields of a saved event: it is the first dated change of the property. */
	firstChange?: boolean;
};

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

export type DiaryObject = {
	id: number;
	name: string;
	active: boolean;
	notes: string;
	coverPhotoId: string | null;
	/** Width / height. */
	coverRatio: number | null;
};

export type ObjectAttr = {
	id: number;
	key: string;
	value: string;
	since: string | null;
	eventId: number | null;
};

export type DiaryEvent = {
	id: number;
	objectId: number;
	objectName: string;
	typeId: number;
	typeName: string;
	category: string;
	milestone: boolean;
	date: string;
	note: string;
	batchId: string | null;
	batchSize: number;
	fields: Field[];
	files: EventFile[];
};

export type ValueCandidate = Candidate & { byType: Record<number, number> };

export type Vocabulary = {
	types: EventTypeStats[];
	categories: Candidate[];
	keys: Record<FieldTarget, ValueCandidate[]>;
	values: Record<string, ValueCandidate[]>;
};
