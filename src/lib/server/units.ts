import { holdings, shortfall, sidesOf, type Sides, type UnitMove } from '../domain/unitLedger.ts';
import type { EventObject, EventUnitMove, StockMove } from '../types.ts';
import type { Db } from './db.ts';

type MoveRow = {
	id: number;
	object_id: number;
	quantity: number;
	from_id: number | null;
	to_id: number | null;
	date: string | null;
	event_id: number | null;
	type_name: string | null;
};

const MOVES = `SELECT m.id, m.object_id, m.quantity, m.from_id, m.to_id,
		coalesce(e.date, m.since) AS date, m.event_id, t.name AS type_name
	FROM unit_moves m LEFT JOIN events e ON e.id = m.event_id
	LEFT JOIN event_types t ON t.id = e.type_id`;

/** `unit_moves` refuses a move without either side. */
function stored<T>(from: T | null, to: T | null): Sides<T> {
	const sides = sidesOf(from, to);
	if (!sides) throw new Error('A unit move without either side');
	return sides;
}

const fromRow = (r: MoveRow): UnitMove => ({
	id: r.id,
	quantity: r.quantity,
	date: r.date,
	...stored(r.from_id, r.to_id)
});

/** Every stock's moves. */
export function allMoves(db: Db): Map<number, UnitMove[]> {
	const rows = db.prepare(MOVES).all() as MoveRow[];
	return new Map(
		[...Map.groupBy(rows, (r) => r.object_id)].map(([id, moves]) => [id, moves.map(fromRow)])
	);
}

/** Every stock's holders and their counts. */
export function allHoldings(db: Db): Map<number, Map<number, number>> {
	return new Map([...allMoves(db)].map(([id, moves]) => [id, holdings(moves)]));
}

/** Latest first. */
export function movesOf(db: Db, stockId: number): StockMove[] {
	const rows = db
		.prepare(`${MOVES} WHERE m.object_id = ? ORDER BY coalesce(date, '') DESC, m.id DESC`)
		.all(stockId) as MoveRow[];
	return rows.map((r) => ({
		...fromRow(r),
		event: r.event_id === null ? null : { id: r.event_id, typeName: r.type_name ?? '' }
	}));
}

export type NewMove = { quantity: number } & Sides<number>;

export function addMove(
	db: Db,
	stockId: number,
	move: NewMove,
	when: { since: string | null } | { eventId: number }
) {
	db.prepare(
		`INSERT INTO unit_moves (object_id, quantity, from_id, to_id, since, event_id)
		VALUES (?, ?, ?, ?, ?, ?)`
	).run(
		stockId,
		move.quantity,
		move.from,
		move.to,
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
			`SELECT m.event_id, m.quantity, s.id AS stock_id, s.name AS stock_name,
				f.id AS from_id, f.name AS from_name, t.id AS to_id, t.name AS to_name
			FROM unit_moves m JOIN objects s ON s.id = m.object_id
			LEFT JOIN objects f ON f.id = m.from_id LEFT JOIN objects t ON t.id = m.to_id
			WHERE m.event_id IN (SELECT value FROM json_each(?)) ORDER BY m.id`
		)
		.all(JSON.stringify(eventIds)) as {
		event_id: number;
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
				...stored(object(r.from_id, r.from_name), object(r.to_id, r.to_name))
			}))
		])
	);
}

/** The first stock some object would hold fewer than none of. */
export function firstShortfall(
	db: Db
): { stock: string; holder: string; date: string | null } | null {
	const name = db.prepare('SELECT name FROM objects WHERE id = ?');
	for (const [stockId, moves] of allMoves(db)) {
		const short = shortfall(moves);
		if (!short) continue;
		const nameOf = (id: number) => (name.get(id) as { name: string } | undefined)?.name ?? '';
		return { stock: nameOf(stockId), holder: nameOf(short.holder), date: short.date };
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
