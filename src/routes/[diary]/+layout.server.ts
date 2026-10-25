import { error } from '@sveltejs/kit';
import { currentDiary } from '#lib/server/diary.ts';
import { t } from '#lib/i18n.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	const diary = currentDiary();
	// The pages below are the views of a plant diary; other types get their own.
	if (diary.type !== 'plants') error(404, t.errors.notFound);
	return { diary };
};
