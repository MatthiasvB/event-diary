import { error } from '@sveltejs/kit';
import { currentDiary, db } from '#lib/server/diary.ts';
import { getFieldKinds } from '#lib/server/fields.ts';
import { FIELD_KINDS_DATA } from '#lib/fieldKinds.ts';
import { t } from '#lib/i18n.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ depends }) => {
	// leaveForm.ts invalidates this after saving a form, which can add field kinds.
	depends(FIELD_KINDS_DATA);
	const diary = currentDiary();
	if (diary.type !== 'objects') error(404, t.errors.notFound);
	return { diary, fieldKinds: getFieldKinds(db()) };
};
