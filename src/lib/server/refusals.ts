import { formatDate } from '../format.ts';
import { t } from '../i18n.ts';
import { transaction, type Db } from './db.ts';
import { ASSOCIATION_CYCLE, ASSOCIATION_TO_ITSELF } from './diarySchema.ts';
import { firstShortfall } from './units.ts';

export type Refusal = { error: string };

/** Thrown inside `savedUnlessRefused` to undo the save and tell the user why. */
export class Refused extends Error {}

/**
 * Saves in one transaction. What the schema refuses for a reason the user can fix is a message.
 * No object may end up holding fewer than none of a stock's units on any day.
 */
export function savedUnlessRefused<T>(db: Db, save: () => T): T | Refusal {
	try {
		return transaction(db, () => {
			const saved = save();
			const short = firstShortfall(db);
			if (short) {
				const date = short.date === null ? null : formatDate(short.date);
				throw new Refused(t.units.shortfall(short.stock, short.place, date));
			}
			return saved;
		});
	} catch (e) {
		if (e instanceof Refused) return { error: e.message };
		const cycle = [ASSOCIATION_CYCLE, ASSOCIATION_TO_ITSELF];
		if (e instanceof Error && cycle.some((c) => e.message.includes(c))) {
			return { error: t.associations.cycle };
		}
		throw e;
	}
}
