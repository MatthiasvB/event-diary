import {
	kindFrom,
	unitOf,
	type FieldKind,
	type FieldKinds,
	type NameChoice
} from '../fieldKinds.ts';
import { t } from '../i18n.ts';
import type { FieldTarget } from '../types.ts';
import { transaction, type Db } from './db.ts';
import { Refused } from './refusals.ts';

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

/**
 * An association's values become objects: the one of that name, or a new unlisted one when
 * there is none or more than one. Back as text, they become the objects' names. Refused
 * where a stock is in the way.
 */
export function setFieldKind(db: Db, name: string, kind: FieldKind) {
	transaction(db, () => {
		const field = db.prepare('SELECT id, kind FROM fields WHERE name = ?').get(name) as
			{ id: number; kind: FieldKind['kind'] } | undefined;
		if (!field) return;
		const stocks = (sql: string) =>
			(db.prepare(sql).all(field.id) as { name: string }[]).map((r) => r.name);
		if (kind.kind === 'object' && field.kind !== 'object') {
			const holding = stocks(
				`SELECT DISTINCT o.name FROM property_values a JOIN objects o ON o.id = a.object_id
				WHERE a.field_id = ? AND o.stock ORDER BY o.name`
			);
			if (holding.length) throw new Refused(t.units.stocksHaveValues(name, holding));
			useField(db, name, 'property');
			valuesToObjects(db, field.id);
		} else if (kind.kind !== 'object' && field.kind === 'object') {
			const spread = stocks('SELECT name FROM objects WHERE stock_field_id = ? ORDER BY name');
			if (spread.length) throw new Refused(t.units.spreadAlong(name, spread));
			db.prepare(
				`UPDATE property_values SET value = (SELECT name FROM objects WHERE id = target_id),
				target_id = NULL WHERE field_id = ?`
			).run(field.id);
		}
		db.prepare('UPDATE fields SET kind = ?, unit = ? WHERE id = ?').run(
			kind.kind,
			unitOf(kind),
			field.id
		);
	});
}

function valuesToObjects(db: Db, fieldId: number) {
	const values = db
		.prepare('SELECT DISTINCT value FROM property_values WHERE field_id = ? AND value IS NOT NULL')
		.all(fieldId) as { value: string }[];
	const point = db.prepare(
		'UPDATE property_values SET value = NULL, target_id = ? WHERE field_id = ? AND value = ?'
	);
	for (const { value } of values) {
		const [named, ...alike] = db
			.prepare('SELECT id FROM objects WHERE name = ? AND NOT stock')
			.all(value) as { id: number }[];
		const target =
			named && !alike.length
				? named
				: (db
						.prepare('INSERT INTO objects (name, listed) VALUES (?, 0) RETURNING id')
						.get(value) as { id: number });
		point.run(target.id, fieldId, value);
	}
	db.prepare('UPDATE event_type_fields SET default_value = NULL WHERE field_id = ?').run(fieldId);
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
		const role = c.kind.kind === 'object' ? 'property' : c.role;
		insert.run(c.name, role, c.kind.kind, unitOf(c.kind), c.suggest ? 1 : 0);
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

export function associationKeys(db: Db): string[] {
	const kinds = getFieldKinds(db);
	return sortProperties(
		db,
		Object.keys(kinds).filter((key) => kinds[key].kind === 'object')
	);
}
