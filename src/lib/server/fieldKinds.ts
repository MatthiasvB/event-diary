import { FIELD_KINDS, type FieldKind, type FieldKinds } from '../fieldKinds.ts';
import type { Db } from './db.ts';

export function getFieldKinds(db: Db): FieldKinds {
	const rows = db.prepare('SELECT key, kind, unit FROM field_kinds').all() as ({
		key: string;
	} & FieldKind)[];
	return Object.fromEntries(rows.map(({ key, kind, unit }) => [key, { kind, unit }]));
}

/** Sets the kind of a field name; plain text without unit is the default and not stored. */
export function setFieldKind(db: Db, key: string, kind: FieldKind) {
	if (!FIELD_KINDS.includes(kind.kind)) throw new Error(`Unknown field kind: ${kind.kind}`);
	const unit = kind.kind === 'number' ? kind.unit.trim() : '';
	if (kind.kind === 'text') {
		db.prepare('DELETE FROM field_kinds WHERE key = ?').run(key);
		return;
	}
	db.prepare(
		`INSERT INTO field_kinds (key, kind, unit) VALUES (?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET kind = excluded.kind, unit = excluded.unit`
	).run(key, kind.kind, unit);
}

/** Whether a field name is used anywhere yet (values or event type templates). */
function isUsed(db: Db, key: string): boolean {
	return !!db
		.prepare(
			`SELECT 1 FROM event_attrs WHERE key = ?1 UNION ALL SELECT 1 FROM plant_attrs WHERE key = ?1
			UNION ALL SELECT 1 FROM event_types, json_each(event_types.fields)
				WHERE json_each.value ->> 'key' = ?1
			LIMIT 1`
		)
		.get(key);
}

/**
 * Kinds chosen for names entered for the first time. Only applied to names that have no
 * kind and aren't used yet, so they can't change an existing name. Call before saving the
 * values. Returns the kinds that apply now.
 */
export function learnKinds(db: Db, chosen: FieldKinds): FieldKinds {
	const kinds = getFieldKinds(db);
	for (const [key, kind] of Object.entries(chosen)) {
		if (!key || kinds[key] || kind.kind === 'text' || isUsed(db, key)) continue;
		setFieldKind(db, key, kind);
		kinds[key] = kind;
	}
	return kinds;
}
