// The registry: which diaries exist, who may use them, and login sessions.
// Each diary has its own database (db/diaries/<id>.sqlite) and a type that decides its
// views (for now only "plants"). Users reach a diary through a membership. The owner
// shares it with one-time invite links, so nobody ever sees a list of all users.
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';
import { openDb, transaction, type Db } from './db.ts';

export const DIARY_TYPES = ['plants'] as const;
export type DiaryType = (typeof DIARY_TYPES)[number];
/** The creator owns a diary; others join through an invite as editor or viewer. */
export type Role = 'owner' | 'editor' | 'viewer';
export const SHARED_ROLES = ['editor', 'viewer'] as const;
export type SharedRole = (typeof SHARED_ROLES)[number];
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
	`,
	`
	-- One-time links to join a diary. Only the hash of the token is stored.
	CREATE TABLE invites (
		token_hash TEXT PRIMARY KEY,
		diary_id TEXT NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
		role TEXT NOT NULL,
		created_by TEXT NOT NULL,
		expires_at INTEGER NOT NULL     -- unix ms
	);
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
const RESERVED = new Set(['login', 'logout', 'invite', 'share', 'manifest.webmanifest', '_app']);

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

export function renameDiary(reg: Db, id: string, name: string) {
	reg.prepare('UPDATE diaries SET name = ? WHERE id = ?').run(name, id);
}

/** Removes a diary with its memberships, invites and database file. */
export function deleteDiary(reg: Db, dbDir: string, id: string) {
	reg.prepare('DELETE FROM diaries WHERE id = ?').run(id);
	const file = diaryFile(dbDir, id);
	for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
}

export type Member = { username: string; role: Role };

/** The members of a diary, owner first. */
export function members(reg: Db, id: string): Member[] {
	return reg
		.prepare(
			`SELECT username, role FROM members WHERE diary_id = ?
			ORDER BY role = 'owner' DESC, username`
		)
		.all(id) as Member[];
}

/** Changes the role of a member who isn't the owner. */
export function setRole(reg: Db, id: string, username: string, role: SharedRole) {
	reg
		.prepare("UPDATE members SET role = ? WHERE diary_id = ? AND username = ? AND role != 'owner'")
		.run(role, id, username);
}

/** Removes a member (also used for leaving). The owner can't be removed. */
export function removeMember(reg: Db, id: string, username: string) {
	reg
		.prepare("DELETE FROM members WHERE diary_id = ? AND username = ? AND role != 'owner'")
		.run(id, username);
}

const INVITE_DAYS = 7;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Creates a one-time invite link token. Only its hash is stored. */
export function createInvite(reg: Db, id: string, role: SharedRole, createdBy: string): string {
	const token = randomBytes(32).toString('base64url');
	reg.prepare('DELETE FROM invites WHERE expires_at < ?').run(Date.now());
	reg
		.prepare(
			'INSERT INTO invites (token_hash, diary_id, role, created_by, expires_at) VALUES (?, ?, ?, ?, ?)'
		)
		.run(hash(token), id, role, createdBy, Date.now() + INVITE_DAYS * 86_400_000);
	return token;
}

/** Open invites of a diary; `id` identifies one for revoking (the token can't be recovered). */
export type OpenInvite = { id: string; role: SharedRole; createdBy: string; expiresAt: number };

export function openInvites(reg: Db, diaryId: string): OpenInvite[] {
	return reg
		.prepare(
			`SELECT token_hash AS id, role, created_by AS createdBy, expires_at AS expiresAt
			FROM invites WHERE diary_id = ? AND expires_at > ? ORDER BY expires_at`
		)
		.all(diaryId, Date.now()) as OpenInvite[];
}

export function revokeInvite(reg: Db, diaryId: string, inviteId: string) {
	reg.prepare('DELETE FROM invites WHERE diary_id = ? AND token_hash = ?').run(diaryId, inviteId);
}

export type InviteInfo = {
	diaryId: string;
	diaryName: string;
	role: SharedRole;
	createdBy: string;
};

/** The invite behind a token, if it is still valid. */
export function inviteInfo(reg: Db, token: string): InviteInfo | undefined {
	return reg
		.prepare(
			`SELECT i.diary_id AS diaryId, d.name AS diaryName, i.role, i.created_by AS createdBy
			FROM invites i JOIN diaries d ON d.id = i.diary_id
			WHERE i.token_hash = ? AND i.expires_at > ?`
		)
		.get(hash(token), Date.now()) as InviteInfo | undefined;
}

/**
 * Uses up the invite and makes the user a member. Existing members keep their role.
 * Returns the diary's ID, or undefined if the invite isn't valid (any more).
 */
export function acceptInvite(reg: Db, token: string, username: string): string | undefined {
	return transaction(reg, () => {
		const invite = inviteInfo(reg, token);
		if (!invite) return undefined;
		reg.prepare('DELETE FROM invites WHERE token_hash = ?').run(hash(token));
		reg
			.prepare('INSERT OR IGNORE INTO members (diary_id, username, role) VALUES (?, ?, ?)')
			.run(invite.diaryId, username, invite.role);
		return invite.diaryId;
	});
}
