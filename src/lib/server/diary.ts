import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { t } from '../i18n.ts';
import { config } from './config.ts';
import { openDb, transaction, type Db } from './db.ts';
import { promoteToProperties } from './objects.ts';
import { deleteFiles, measureOldImages } from './files.ts';
import { deleteDiary, diaryFile, memberDiary, registry, type DiaryInfo } from './registry.ts';

export function currentDiary(): DiaryInfo {
	const { params, locals } = getRequestEvent();
	const diary =
		params.diary && locals.user ? memberDiary(registry(), params.diary, locals.user) : undefined;
	if (!diary) error(404, t.errors.notFound);
	return diary;
}

export function requireOwner(): DiaryInfo {
	const diary = currentDiary();
	if (diary.role !== 'owner') error(403, t.errors.forbidden);
	return diary;
}

const open = new Map<string, Db>();

export function db(): Db {
	const { id } = currentDiary();
	let diary = open.get(id);
	if (!diary) {
		diary = openDb(diaryFile(config.dbDir, id));
		const d = diary;
		transaction(d, () => promoteToProperties(d));
		measureOldImages(d).catch((e) => console.error('Measuring images failed:', e));
		open.set(id, diary);
	}
	return diary;
}

export function diaryContents(): { objects: number; events: number; files: number } {
	return db()
		.prepare(
			`SELECT (SELECT count(*) FROM objects) AS objects, (SELECT count(*) FROM events) AS events,
			(SELECT count(*) FROM files) AS files`
		)
		.get() as { objects: number; events: number; files: number };
}

export function deleteCurrentDiary() {
	const { id } = requireOwner();
	const diary = db();
	const files = (diary.prepare('SELECT id FROM files').all() as { id: string }[]).map((r) => r.id);
	deleteFiles(diary, files);
	diary.close();
	open.delete(id);
	deleteDiary(registry(), config.dbDir, id);
}
