// The registry: which diaries exist, who may use them, and login sessions.
// Each diary has its own database (db/diaries/<id>.sqlite) and a type that decides its
// views (for now only "plants"). Users reach a diary through a membership; sharing a
// diary later means adding a membership, nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';
import { openDb, type Db } from './db.ts';

export const DIARY_TYPES = ['plants'] as const;
export type DiaryType = (typeof DIARY_TYPES)[number];
/** For now every member is an owner; "member" or "viewer" can be added for sharing. */
export type Role = 'owner';
export type DiaryInfo = { id: string; name: string; type: DiaryType; role: Role };

/** The user when there is no login (AUTH_BACKEND=none). */
export const LOCAL_USER = 'local';

const SCHEMA = [
	`
	CREATE TABLE sessions (
		token_hash TEXT PRIMARY KEY,
		username TEXT NOT NULL,
		expires_at INTEGER NOT NULL     -- unix ms
	);

	CREATE TABLE diaries (
		id TEXT PRIMARY KEY,            -- also the URL segment and the database file name
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE members (
		diary_id TEXT NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
		username TEXT NOT NULL,
		role TEXT NOT NULL,
		PRIMARY KEY (diary_id, username)
	);
	CREATE INDEX members_user ON members(username);
	`
];

export function openRegistry(file: string): Db {
	return openDb(file, SCHEMA);
}

let instance: Db | undefined;

/** The app's registry, opened on first use. */
export function registry(): Db {
	instance ??= openRegistry(path.join(config.dbDir, 'registry.sqlite'));
	return instance;
}

export function diaryFile(dbDir: string, id: string): string {
	return path.join(dbDir, 'diaries', `${id}.sqlite`);
}

/** Where all data lived before there were several diaries and users. */
export function legacyDiaryFile(dbDir: string): string {
	return path.join(dbDir, 'diary.sqlite');
}

export function userDiaries(reg: Db, user: string): DiaryInfo[] {
	return reg
		.prepare(
			`SELECT d.id, d.name, d.type, m.role FROM diaries d
			JOIN members m ON m.diary_id = d.id WHERE m.username = ? ORDER BY d.name`
		)
		.all(user) as DiaryInfo[];
}

/** The diary, if the user is a member of it. */
export function memberDiary(reg: Db, id: string, user: string): DiaryInfo | undefined {
	return reg
		.prepare(
			`SELECT d.id, d.name, d.type, m.role FROM diaries d
			JOIN members m ON m.diary_id = d.id WHERE d.id = ? AND m.username = ?`
		)
		.get(id, user) as DiaryInfo | undefined;
}

// URL segments the app uses itself.
const RESERVED = new Set(['login', 'logout', 'claim', 'share', 'manifest.webmanifest', '_app']);

/** A readable, unique ID for the URL: "Pflanzentagebuch" → "pflanzentagebuch(-2)". */
function newId(reg: Db, name: string): string {
	const base =
		name
			.toLowerCase()
			.replace(/ä/g, 'ae')
			.replace(/ö/g, 'oe')
			.replace(/ü/g, 'ue')
			.replace(/ß/g, 'ss')
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'tagebuch';
	const taken = (id: string) =>
		RESERVED.has(id) || !!reg.prepare('SELECT 1 FROM diaries WHERE id = ?').get(id);
	let id = base;
	for (let n = 2; taken(id); n++) id = `${base}-${n}`;
	return id;
}

export function createDiary(reg: Db, name: string, type: DiaryType, owner: string): string {
	reg.exec('BEGIN IMMEDIATE');
	try {
		const id = newId(reg, name);
		reg.prepare('INSERT INTO diaries (id, name, type) VALUES (?, ?, ?)').run(id, name, type);
		reg
			.prepare("INSERT INTO members (diary_id, username, role) VALUES (?, ?, 'owner')")
			.run(id, owner);
		reg.exec('COMMIT');
		return id;
	} catch (e) {
		reg.exec('ROLLBACK');
		throw e;
	}
}

/**
 * Turns the data from before there were several diaries into a plant diary owned by
 * `owner`, by moving its database file. Returns the new diary's ID.
 */
export function adoptLegacyDiary(reg: Db, dbDir: string, owner: string, name: string): string {
	const from = legacyDiaryFile(dbDir);
	if (!fs.existsSync(from)) throw new Error('There is no data waiting for an owner');
	// Opening applies pending migrations; closing the last connection folds the
	// write-ahead log into the file, so that one rename moves everything.
	openDb(from).close();
	const id = createDiary(reg, name, 'plants', owner);
	const to = diaryFile(dbDir, id);
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.renameSync(from, to);
	for (const suffix of ['-wal', '-shm']) fs.rmSync(from + suffix, { force: true });
	return id;
}
