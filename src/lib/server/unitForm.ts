import { sidesOf, type Sides } from '../domain/unitLedger.ts';
import { isValidDate } from '../format.ts';
import { t } from '../i18n.ts';
import type { Db } from './db.ts';
import type { StockUnitsMove } from './events.ts';
import { getObject, resolveTarget } from './objects.ts';
import { Refused, savedUnlessRefused, type Refusal } from './refusals.ts';
import { addMove, deleteMove } from './units.ts';

/** As entered: `to` is an item, or the name of one to create. */
export type MoveDraft = { stockId: number; quantity: number } & Sides<number, string>;

const id = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

export function parseMove(
	raw: Partial<Record<'stock' | 'quantity' | 'from' | 'to', unknown>>
): MoveDraft | null {
	const stockId = id(raw.stock);
	const quantity = id(raw.quantity);
	const to = typeof raw.to === 'string' && raw.to.trim() ? raw.to.trim() : null;
	const sides = sidesOf(id(raw.from), to);
	return stockId !== null && quantity !== null && sides ? { stockId, quantity, ...sides } : null;
}

/** Creates the new objects the moves go to. Moves of objects that are no stock are refused. */
export function resolveMoves(db: Db, drafts: MoveDraft[]): StockUnitsMove[] {
	const refuse = (): never => {
		throw new Refused(t.errors.generic);
	};
	return drafts.map((d) => {
		if (!getObject(db, d.stockId)?.stock) refuse();
		const { stockId, quantity } = d;
		const holder = (value: string) => resolveTarget(db, value) ?? refuse();
		if (d.from === null) return { stockId, quantity, from: null, to: holder(d.to) };
		const to = d.to === null ? null : holder(d.to);
		if (to === d.from) throw new Refused(t.units.sameHolder);
		return { stockId, quantity, from: d.from, to };
	});
}

export function saveMove(form: FormData, db: Db): Refusal | null {
	const move = parseMove({
		stock: form.get('stock'),
		quantity: form.get('quantity'),
		from: form.get('from'),
		to: form.get('to')
	});
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
