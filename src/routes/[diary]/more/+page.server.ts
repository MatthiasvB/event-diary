import { db } from '#lib/server/diary.ts';
import { listObjects } from '#lib/server/objects.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	unlisted: listObjects(db())
		.filter((o) => !o.listed)
		.map(({ id, name }) => ({ id, name }))
});
