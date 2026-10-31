import type { NameChoice } from './fieldKinds.ts';
import type { EventFile } from './files.ts';

import type { Candidate } from './suggest.ts';

export type FieldTarget = 'event' | 'object';

/** What a change does to the value before it, if it is the property's first change. */
export type InitialChoice = { kind: 'keep' } | { kind: 'unknown' } | { kind: 'set'; value: string };
export const KEEP: InitialChoice = { kind: 'keep' };

/** A field as entered. */
type EntryBase = { key: string; value: string; chosen?: NameChoice };
export type FieldEntry =
	(EntryBase & { target: 'event' }) | (EntryBase & { target: 'object'; initial: InitialChoice });

export const entry = (target: FieldTarget, key: string, value: string): FieldEntry =>
	target === 'object' ? { target, key, value, initial: KEEP } : { target, key, value };

/** `initial` tells whether the replaced value is the initial one. */
export type Replaced = { value: string; initial: boolean } | null;

export type EventDetail = { target: 'event'; key: string; value: string };
export type PropertyChange = {
	target: 'object';
	key: string;
	value: string;
	objectId: number;
	replaced: Replaced;
};
export type RecordedField = EventDetail | PropertyChange;

export type FieldTemplate = { key: string; target: FieldTarget; default?: string };

export type EventType = {
	id: number;
	name: string;
	category: string | null;
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

export type PropertyValue = { id: number; key: string; value: string } & (
	{ since: null; eventId: null } | { since: string; eventId: number | null }
);

export type EventObject = { id: number; name: string };

/** `objects` has at least one, in the order of their names. */
export type DiaryEvent = {
	id: number;
	objects: EventObject[];
	typeId: number;
	typeName: string;
	category: string | null;
	milestone: boolean;
	date: string;
	note: string;
	fields: RecordedField[];
	files: EventFile[];
};

export type ValueCandidate = Candidate & { byType: Record<number, number> };

export type Vocabulary = {
	types: EventTypeStats[];
	categories: Candidate[];
	keys: Record<FieldTarget, ValueCandidate[]>;
	values: Record<string, ValueCandidate[]>;
};
