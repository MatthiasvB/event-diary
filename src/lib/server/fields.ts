import {
	kindFrom,
	unitOf,
	type FieldKind,
	type FieldKinds,
	type NameChoice
} from '../fieldKinds.ts';
import type { FieldTarget } from '../types.ts';
import { transaction, type Db } from './db.ts';

export type Role = 'detail' | 'property';
type FieldRow = { id: number; role: Role };

export const roleOf = (target: FieldTarget): Role => (target === 'object' ? 'property' : 'detail');
export const targetOf = (role: Role): FieldTarget => (role === 'property' ? 'object' : 'event');

/**
 * Creates the field if it is new. A detail asked for as a property becomes one, and a
 * property stays one.
 */
export function useField(db: Db, name: string, role: Role): FieldRow {
	const field = db
		.prepare(
			`INSERT INTO fields (name, role) VALUES (?, ?)
			ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id, role`
		)
		.get(name, role) as FieldRow;
	if (role === 'property' && field.role === 'detail') makeProperty(db, field.id);
	return role === 'property' ? { id: field.id, role } : field;
}

/** Its values on past events become changes of the property on the event's date. */
function makeProperty(db: Db, id: number) {
	transaction(db, () => {
		db.prepare(
			`INSERT INTO property_values (object_id, field_id, value, event_id)
			SELECT eo.object_id, d.field_id, d.value, d.event_id
			FROM event_details d JOIN events e ON e.id = d.event_id
			JOIN event_objects eo ON eo.event_id = d.event_id
			WHERE d.field_id = ? ORDER BY e.date, e.id, eo.object_id`
		).run(id);
		db.prepare('DELETE FROM event_details WHERE field_id = ?').run(id);
		db.prepare("UPDATE fields SET role = 'property' WHERE id = ?").run(id);
	});
}

export function propertyKeys(db: Db): Set<string> {
	const rows = db.prepare("SELECT name FROM fields WHERE role = 'property'").all() as {
		name: string;
	}[];
	return new Set(rows.map((r) => r.name));
}

export function getFieldKinds(db: Db): FieldKinds {
	const rows = db.prepare("SELECT name, kind, unit FROM fields WHERE kind != 'text'").all() as {
		name: string;
		kind: FieldKind['kind'];
		unit: string | null;
	}[];
	return Object.fromEntries(rows.map((r) => [r.name, kindFrom(r.kind, r.unit ?? '')]));
}

export function setFieldKind(db: Db, name: string, kind: FieldKind) {
	db.prepare('UPDATE fields SET kind = ?, unit = ? WHERE name = ?').run(
		kind.kind,
		unitOf(kind),
		name
	);
}

/** Names whose values are typed freely, without suggestions. */
export function withoutSuggestions(db: Db): string[] {
	const rows = db
		.prepare('SELECT name FROM fields WHERE NOT suggest_values ORDER BY name')
		.all() as { name: string }[];
	return rows.map((r) => r.name);
}

export function setSuggestValues(db: Db, name: string, suggest: boolean) {
	db.prepare('UPDATE fields SET suggest_values = ? WHERE name = ?').run(suggest ? 1 : 0, name);
}

export type ChosenName = NameChoice & { name: string; role: Role };

/** A choice applies only to a name without a field yet. Call before saving the values. */
export function learnChoices(db: Db, chosen: ChosenName[]): FieldKinds {
	const insert = db.prepare(
		`INSERT INTO fields (name, role, kind, unit, suggest_values) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (name) DO NOTHING`
	);
	for (const c of chosen) {
		if (!c.name || (c.kind.kind === 'text' && c.suggest)) continue;
		insert.run(c.name, c.role, c.kind.kind, unitOf(c.kind), c.suggest ? 1 : 0);
	}
	return getFieldKinds(db);
}

export function getPropertyOrder(db: Db): string[] {
	const rows = db
		.prepare('SELECT name FROM fields WHERE position IS NOT NULL ORDER BY position')
		.all() as { name: string }[];
	return rows.map((r) => r.name);
}

export function setPropertyOrder(db: Db, names: string[]) {
	transaction(db, () => {
		db.prepare('UPDATE fields SET position = NULL').run();
		const set = db.prepare("UPDATE fields SET position = ? WHERE name = ? AND role = 'property'");
		[...new Set(names.filter(Boolean))].forEach((name, i) => set.run(i, name));
	});
}

export function sortProperties(db: Db, names: string[]): string[] {
	const order = getPropertyOrder(db);
	const rank = (name: string) => {
		const i = order.indexOf(name);
		return i < 0 ? order.length : i;
	};
	return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'de'));
}
