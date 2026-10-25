import { db } from '#lib/server/diary.ts';
import { listTypes } from '#lib/server/eventTypes.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ types: listTypes(db()) });
