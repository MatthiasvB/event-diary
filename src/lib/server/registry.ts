import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';
import { openDb, transaction, type Db, type Schema } from './db.ts';

export const DIARY_TYPES = ['objects'] as const;
export type DiaryType = (typeof DIARY_TYPES)[number];
export const SHARED_ROLES = ['editor', 'viewer'] as const;
export type SharedRole = (typeof SHARED_ROLES)[number];
export type Role = 'owner' | SharedRole;
export type DiaryInfo = { id: string; name: string; type: DiaryType; role: Role };

export const LOCAL_USER = 'local';

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

export const REGISTRY_SCHEMA: Schema = {
	version: 4,
	create: `
	CREATE TABLE sessions (
		token_hash TEXT PRIMARY KEY,
		username TEXT NOT NULL,
		expires_at INTEGER NOT NULL
	);

	CREATE TABLE diaries (
		id TEXT PRIMARY KEY,            -- also the URL segment and the database file name
		name TEXT NOT NULL,
		type TEXT NOT NULL CHECK (type IN (${inList(DIARY_TYPES)})),
		owner TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX diaries_owner ON diaries(owner);

	CREATE TABLE members (
		diary_id TEXT NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
		username TEXT NOT NULL,
		role TEXT NOT NULL CHECK (role IN (${inList(SHARED_ROLES)})),
		PRIMARY KEY (diary_id, username)
	);
	CREATE INDEX members_user ON members(username);

	-- The owner is no member: inviting them leaves them the owner.
	CREATE TRIGGER members_not_owner BEFORE INSERT ON members
	WHEN new.username = (SELECT owner FROM diaries WHERE id = new.diary_id)
	BEGIN
		SELECT RAISE(IGNORE);
	END;

	CREATE TABLE invites (
		token_hash TEXT PRIMARY KEY,
		diary_id TEXT NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
		role TEXT NOT NULL CHECK (role IN (${inList(SHARED_ROLES)})),
		created_by TEXT NOT NULL,
		expires_at INTEGER NOT NULL
	);
	`,
	migrations: {}
};

export function openRegistry(file: string): Db {
	return openDb(file, REGISTRY_SCHEMA);
}

let instance: Db | undefined;

export function registry(): Db {
	instance ??= openRegistry(registryFile(config.dbDir));
	return instance;
}

export function registryFile(dbDir: string): string {
	return path.join(dbDir, 'registry.sqlite');
}

export function diaryFile(dbDir: string, id: string): string {
	return path.join(dbDir, 'diaries', `${id}.sqlite`);
}

export function diaryIds(reg: Db): string[] {
	return (reg.prepare('SELECT id FROM diaries').all() as { id: string }[]).map((r) => r.id);
}

const ACCESS = `SELECT d.id, d.name, d.type,
		CASE WHEN d.owner = ?1 THEN 'owner' ELSE m.role END AS role
	FROM diaries d LEFT JOIN members m ON m.diary_id = d.id AND m.username = ?1
	WHERE (d.owner = ?1 OR m.username IS NOT NULL)`;

export function userDiaries(reg: Db, user: string): DiaryInfo[] {
	return reg.prepare(`${ACCESS} ORDER BY d.name`).all(user) as DiaryInfo[];
}

export function memberDiary(reg: Db, id: string, user: string): DiaryInfo | undefined {
	return reg.prepare(`${ACCESS} AND d.id = ?2`).get(user, id) as DiaryInfo | undefined;
}

// URL segments the app uses itself.
const RESERVED = new Set(['login', 'logout', 'invite', 'share', 'manifest.webmanifest', '_app']);

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
	return transaction(reg, () => {
		const id = newId(reg, name);
		reg
			.prepare('INSERT INTO diaries (id, name, type, owner) VALUES (?, ?, ?, ?)')
			.run(id, name, type, owner);
		return id;
	});
}

export function renameDiary(reg: Db, id: string, name: string) {
	reg.prepare('UPDATE diaries SET name = ? WHERE id = ?').run(name, id);
}

export function deleteDiary(reg: Db, dbDir: string, id: string) {
	reg.prepare('DELETE FROM diaries WHERE id = ?').run(id);
	const file = diaryFile(dbDir, id);
	for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
}

export type Member = { username: string; role: Role };

export function members(reg: Db, id: string): Member[] {
	return reg
		.prepare(
			`SELECT owner AS username, 'owner' AS role FROM diaries WHERE id = ?1
			UNION ALL SELECT * FROM (SELECT username, role FROM members WHERE diary_id = ?1 ORDER BY username)`
		)
		.all(id) as Member[];
}

export function setRole(reg: Db, id: string, username: string, role: SharedRole) {
	reg
		.prepare('UPDATE members SET role = ? WHERE diary_id = ? AND username = ?')
		.run(role, id, username);
}

export function removeMember(reg: Db, id: string, username: string) {
	reg.prepare('DELETE FROM members WHERE diary_id = ? AND username = ?').run(id, username);
}

const INVITE_DAYS = 7;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

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

/** `id` is the token's hash, since the token itself isn't stored. */
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

export function inviteInfo(reg: Db, token: string): InviteInfo | undefined {
	return reg
		.prepare(
			`SELECT i.diary_id AS diaryId, d.name AS diaryName, i.role, i.created_by AS createdBy
			FROM invites i JOIN diaries d ON d.id = i.diary_id
			WHERE i.token_hash = ? AND i.expires_at > ?`
		)
		.get(hash(token), Date.now()) as InviteInfo | undefined;
}

/** Existing members keep their role. */
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
