import { parseMove, type MoveDraft } from '../domain/unitLedger.ts';
import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import type { Db } from './db.ts';
import type { StockUnitsMove } from './events.ts';
import { getObject, resolveTarget } from './objects.ts';
import { Refused, savedUnlessRefused, type Refusal } from './refusals.ts';
import { addMove, deleteMove } from './units.ts';

/** Creates the new objects units go to. Moves of objects that are no stock are refused. */
export function resolveMoves(db: Db, drafts: MoveDraft[]): StockUnitsMove[] {
	const refuse = (): never => {
		throw new Refused(t.errors.generic);
	};
	const place = (value: string | null) =>
		value === null ? null : (resolveTarget(db, value) ?? refuse());
	return drafts.map((d): StockUnitsMove => {
		if (!getObject(db, d.stockId)?.stock) refuse();
		const { stockId, quantity } = d;
		if (d.kind === 'remove') return { stockId, quantity, kind: 'remove', from: d.from };
		const to = place(d.to);
		if (d.kind === 'add') return { stockId, quantity, kind: 'add', to };
		if (to === d.from) throw new Refused(t.units.sameHolder);
		return { stockId, quantity, kind: 'move', from: d.from, to };
	});
}

/** The form sends the move as JSON, in the shape of a `MoveRow`. */
export function saveMove(form: FormData, db: Db): Refusal | null {
	const move = parseMove(JSON.parse(String(form.get('move') ?? 'null')));
	if (!move) return { error: t.units.incomplete };
	const date = String(form.get('date') ?? '');
	if (date && !isValidDate(date)) return { error: t.events.badDate };
	return savedUnlessRefused(db, () => {
		const [{ stockId, ...resolved }] = resolveMoves(db, [move]);
		addMove(db, stockId, resolved, { since: date || null });
		return null;
	});
}

export function removeMove(db: Db, stockId: number, moveId: number): Refusal | null {
	return savedUnlessRefused(db, () => {
		deleteMove(db, stockId, moveId);
		return null;
	});
}
