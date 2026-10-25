// The diary of the current request (the /<diary>/… part of the URL). It is only opened
// if the logged-in user is a member, so data can't leak between users or diaries.
// Photo files are shared in photos/, but are only served when the diary references them.
import fs from 'node:fs';
import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { t } from '../i18n.ts';
import { config } from './config.ts';
import { openDb, type Db } from './db.ts';
import {
	adoptLegacyDiary,
	diaryFile,
	legacyDiaryFile,
	memberDiary,
	registry,
	type DiaryInfo
} from './registry.ts';

/** The current diary; "not found" unless the user is a member. */
export function currentDiary(): DiaryInfo {
	const { params, locals } = getRequestEvent();
	const diary =
		params.diary && locals.user ? memberDiary(registry(), params.diary, locals.user) : undefined;
	if (!diary) error(404, t.errors.notFound);
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

/** Data from before there were several diaries and users, still without owner. */
export function needsOwner(): boolean {
	return fs.existsSync(legacyDiaryFile(config.dbDir));
}

/** Gives that data to `owner` as their plant diary. Returns the diary's ID. */
export function claimLegacyDiary(owner: string): string {
	return adoptLegacyDiary(registry(), config.dbDir, owner, config.appName);
}
