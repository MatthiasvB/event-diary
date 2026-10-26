// The diary of the current request (the /<diary>/… part of the URL). It is only opened
// if the logged-in user is a member, so data can't leak between users or diaries.
// Attached files are shared in photos/, but are only served when the diary references them.
import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { t } from '../i18n.ts';
import { config } from './config.ts';
import { openDb, type Db } from './db.ts';
import { deleteFiles } from './files.ts';
import { deleteDiary, diaryFile, memberDiary, registry, type DiaryInfo } from './registry.ts';

/** The current diary; "not found" unless the user is a member. */
export function currentDiary(): DiaryInfo {
	const { params, locals } = getRequestEvent();
	const diary =
		params.diary && locals.user ? memberDiary(registry(), params.diary, locals.user) : undefined;
	if (!diary) error(404, t.errors.notFound);
	return diary;
}

/** The current diary, if the user owns it; otherwise "forbidden". */
export function requireOwner(): DiaryInfo {
	const diary = currentDiary();
	if (diary.role !== 'owner') error(403, t.errors.forbidden);
	return diary;
}

const open = new Map<string, Db>();

/** The current diary's database, opened on first use. */
export function db(): Db {
	const { id } = currentDiary();
	let diary = open.get(id);
	if (!diary) {
		diary = openDb(diaryFile(config.dbDir, id));
		open.set(id, diary);
	}
	return diary;
}

/** What deleting the current diary takes along. */
export function diaryContents(): { objects: number; events: number; files: number } {
	return db()
		.prepare(
			`SELECT (SELECT count(*) FROM objects) AS objects, (SELECT count(*) FROM events) AS events,
			(SELECT count(*) FROM files) AS files`
		)
		.get() as { objects: number; events: number; files: number };
}

/** Deletes the current diary with everything in it, including its photo files. Owners only. */
export function deleteCurrentDiary() {
	const { id } = requireOwner();
	const diary = db();
	const files = (diary.prepare('SELECT id FROM files').all() as { id: string }[]).map((r) => r.id);
	deleteFiles(diary, files);
	diary.close();
	open.delete(id);
	deleteDiary(registry(), config.dbDir, id);
}
