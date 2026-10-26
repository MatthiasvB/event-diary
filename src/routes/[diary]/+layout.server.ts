import { error } from '@sveltejs/kit';
import { currentDiary, db } from '#lib/server/diary.ts';
import { getFieldKinds } from '#lib/server/fieldKinds.ts';
import { FIELD_KINDS_DATA } from '#lib/fieldKinds.ts';
import { t } from '#lib/i18n.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ depends }) => {
	// Saving a form can add field kinds (a new name with a kind), see leaveForm.ts.
	depends(FIELD_KINDS_DATA);
	const diary = currentDiary();
	// The pages below are the views of a plant diary; other types get their own.
	if (diary.type !== 'plants') error(404, t.errors.notFound);
	// Kinds of field values (date, number), for input and display everywhere in the diary.
	return { diary, fieldKinds: getFieldKinds(db()) };
};
