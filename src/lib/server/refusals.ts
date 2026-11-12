import { t } from '../i18n.ts';
import { transaction, type Db } from './db.ts';
import { ASSOCIATION_CYCLE, ASSOCIATION_TO_ITSELF } from './diarySchema.ts';

export type Refusal = { error: string };

/** Saves in one transaction. What the schema refuses for a reason the user can fix is a message. */
export function savedUnlessRefused<T>(db: Db, save: () => T): T | Refusal {
	try {
		return transaction(db, save);
	} catch (e) {
		const cycle = [ASSOCIATION_CYCLE, ASSOCIATION_TO_ITSELF];
		if (e instanceof Error && cycle.some((c) => e.message.includes(c))) {
			return { error: t.associations.cycle };
		}
		throw e;
	}
}
