import {
	holdings,
	shortfall,
	type Kinded,
	type Place,
	type UnitMove
} from '../domain/unitLedger.ts';
import type { EventObject, EventUnitMove, StockMove } from '../types.ts';
import type { Db } from './db.ts';

type StoredMove = {
	id: number;
	object_id: number;
	kind: UnitMove['kind'];
	quantity: number;
	from_id: number | null;
	to_id: number | null;
	date: string | null;
	event_id: number | null;
	type_name: string | null;
};

const MOVES = `SELECT m.id, m.object_id, m.kind, m.quantity, m.from_id, m.to_id,
		coalesce(e.date, m.since) AS date, m.event_id, t.name AS type_name
	FROM unit_moves m LEFT JOIN events e ON e.id = m.event_id
	LEFT JOIN event_types t ON t.id = e.type_id`;

/** `unit_moves` keeps `from_id` empty for an addition and `to_id` for a removal. */
function kinded<T>(kind: UnitMove['kind'], from: T | null, to: T | null): Kinded<T> {
	if (kind === 'add') return { kind, to };
	if (kind === 'remove') return { kind, from };
	return { kind, from, to };
}

const fromRow = (r: StoredMove): UnitMove => ({
	id: r.id,
	quantity: r.quantity,
	date: r.date,
	...kinded(r.kind, r.from_id, r.to_id)
});

/** Every stock's moves. */
export function allMoves(db: Db): Map<number, UnitMove[]> {
	const rows = db.prepare(MOVES).all() as StoredMove[];
	return new Map(
		[...Map.groupBy(rows, (r) => r.object_id)].map(([id, moves]) => [id, moves.map(fromRow)])
	);
}

/** Every stock's places and their counts. */
export function allHoldings(db: Db): Map<number, Map<Place, number>> {
	return new Map([...allMoves(db)].map(([id, moves]) => [id, holdings(moves)]));
}

/** Latest first. */
export function movesOf(db: Db, stockId: number): StockMove[] {
	const rows = db
		.prepare(`${MOVES} WHERE m.object_id = ? ORDER BY coalesce(date, '') DESC, m.id DESC`)
		.all(stockId) as StoredMove[];
	return rows.map((r) => ({
		...fromRow(r),
		event: r.event_id === null ? null : { id: r.event_id, typeName: r.type_name ?? '' }
	}));
}

export type NewMove = { quantity: number } & Kinded<number>;

export function addMove(
	db: Db,
	stockId: number,
	move: NewMove,
	when: { since: string | null } | { eventId: number }
) {
	db.prepare(
		`INSERT INTO unit_moves (object_id, kind, quantity, from_id, to_id, since, event_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`
	).run(
		stockId,
		move.kind,
		move.quantity,
		move.kind === 'add' ? null : move.from,
		move.kind === 'remove' ? null : move.to,
		'since' in when ? when.since : null,
		'eventId' in when ? when.eventId : null
	);
}

/** Moves recorded with an event go with the event. */
export function deleteMove(db: Db, stockId: number, moveId: number) {
	db.prepare('DELETE FROM unit_moves WHERE id = ? AND object_id = ? AND event_id IS NULL').run(
		moveId,
		stockId
	);
}

export function eventMoves(db: Db, eventIds: number[]): Map<number, EventUnitMove[]> {
	const rows = db
		.prepare(
			`SELECT m.event_id, m.kind, m.quantity, s.id AS stock_id, s.name AS stock_name,
				f.id AS from_id, f.name AS from_name, t.id AS to_id, t.name AS to_name
			FROM unit_moves m JOIN objects s ON s.id = m.object_id
			LEFT JOIN objects f ON f.id = m.from_id LEFT JOIN objects t ON t.id = m.to_id
			WHERE m.event_id IN (SELECT value FROM json_each(?)) ORDER BY m.id`
		)
		.all(JSON.stringify(eventIds)) as {
		event_id: number;
		kind: UnitMove['kind'];
		quantity: number;
		stock_id: number;
		stock_name: string;
		from_id: number | null;
		from_name: string | null;
		to_id: number | null;
		to_name: string | null;
	}[];
	const object = (id: number | null, name: string | null): EventObject | null =>
		id === null ? null : { id, name: name ?? '' };
	return new Map(
		[...Map.groupBy(rows, (r) => r.event_id)].map(([eventId, moves]) => [
			eventId,
			moves.map((r) => ({
				stock: { id: r.stock_id, name: r.stock_name },
				quantity: r.quantity,
				...kinded(r.kind, object(r.from_id, r.from_name), object(r.to_id, r.to_name))
			}))
		])
	);
}

/** The first stock some place would hold fewer than none of. A `null` place is unassigned. */
export function firstShortfall(
	db: Db
): { stock: string; place: string | null; date: string | null } | null {
	const name = db.prepare('SELECT name FROM objects WHERE id = ?');
	const nameOf = (id: number) => (name.get(id) as { name: string } | undefined)?.name ?? '';
	for (const [stockId, moves] of allMoves(db)) {
		const short = shortfall(moves);
		if (!short) continue;
		const place = short.place === null ? null : nameOf(short.place);
		return { stock: nameOf(stockId), place, date: short.date };
	}
	return null;
}

/** Whether anything keeps the object from becoming a stock, or a stock from becoming an item. */
export function stockLocked(db: Db, id: number): boolean {
	return !!db
		.prepare(
			`SELECT 1 WHERE EXISTS (SELECT 1 FROM unit_moves WHERE ?1 IN (object_id, from_id, to_id))
			OR EXISTS (SELECT 1 FROM property_values WHERE ?1 IN (object_id, target_id)
				AND target_id IS NOT NULL)`
		)
		.get(id);
}
