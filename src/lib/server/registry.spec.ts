import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { openDb } from './db.ts';
import {
	acceptInvite,
	createDiary,
	createInvite,
	deleteDiary,
	diaryFile,
	inviteInfo,
	memberDiary,
	members,
	openInvites,
	openRegistry,
	removeMember,
	revokeInvite,
	setRole,
	userDiaries
} from './registry.ts';

describe('diaries and members', () => {
	it('gives each user only their own diaries', () => {
		const reg = openRegistry(':memory:');
		const alice = createDiary(reg, 'Pflanzentagebuch', 'objects', 'alice');
		const bob = createDiary(reg, 'Pflanzentagebuch', 'objects', 'bob');

		expect(alice).toBe('pflanzentagebuch');
		expect(bob).toBe('pflanzentagebuch-2');
		expect(userDiaries(reg, 'alice').map((d) => d.id)).toEqual([alice]);
		expect(memberDiary(reg, alice, 'alice')).toMatchObject({ role: 'owner', type: 'objects' });
		expect(memberDiary(reg, alice, 'bob')).toBeUndefined();
	});

	it('makes readable, unique IDs that do not collide with app paths', () => {
		const reg = openRegistry(':memory:');
		expect(createDiary(reg, 'Hausbau Küche & Bad', 'objects', 'a')).toBe('hausbau-kueche-bad');
		expect(createDiary(reg, 'Login', 'objects', 'a')).toBe('login-2');
		expect(createDiary(reg, '!!!', 'objects', 'a')).toBe('tagebuch');
	});
});

describe('sharing', () => {
	it('lets one person join through an invite link, once', () => {
		const reg = openRegistry(':memory:');
		const id = createDiary(reg, 'Orchideen', 'objects', 'alice');
		const token = createInvite(reg, id, 'viewer', 'alice');

		expect(inviteInfo(reg, token)).toEqual({
			diaryId: id,
			diaryName: 'Orchideen',
			role: 'viewer',
			createdBy: 'alice'
		});
		expect(acceptInvite(reg, token, 'bob')).toBe(id);
		expect(memberDiary(reg, id, 'bob')?.role).toBe('viewer');
		expect(acceptInvite(reg, token, 'carol')).toBeUndefined();
		expect(memberDiary(reg, id, 'carol')).toBeUndefined();
		expect(inviteInfo(reg, 'made-up')).toBeUndefined();
	});

	it('expires and revokes links, and keeps the role of existing members', () => {
		const reg = openRegistry(':memory:');
		const id = createDiary(reg, 'Orchideen', 'objects', 'alice');
		// Created 8 days ago; links are valid for 7.
		vi.useFakeTimers({ now: Date.now() - 8 * 86_400_000 });
		const old = createInvite(reg, id, 'editor', 'alice');
		vi.useRealTimers();
		expect(acceptInvite(reg, old, 'bob')).toBeUndefined();
		expect(openInvites(reg, id)).toEqual([]);

		const revoked = createInvite(reg, id, 'editor', 'alice');
		const [open] = openInvites(reg, id);
		revokeInvite(reg, id, open.id);
		expect(acceptInvite(reg, revoked, 'bob')).toBeUndefined();

		const own = createInvite(reg, id, 'viewer', 'alice');
		expect(acceptInvite(reg, own, 'alice')).toBe(id);
		expect(memberDiary(reg, id, 'alice')?.role).toBe('owner');
	});

	it('lets the owner change roles and remove members, but never the owner', () => {
		const reg = openRegistry(':memory:');
		const id = createDiary(reg, 'Orchideen', 'objects', 'alice');
		acceptInvite(reg, createInvite(reg, id, 'viewer', 'alice'), 'bob');

		setRole(reg, id, 'bob', 'editor');
		setRole(reg, id, 'alice', 'viewer');
		expect(members(reg, id)).toEqual([
			{ username: 'alice', role: 'owner' },
			{ username: 'bob', role: 'editor' }
		]);

		removeMember(reg, id, 'bob');
		removeMember(reg, id, 'alice');
		expect(members(reg, id)).toEqual([{ username: 'alice', role: 'owner' }]);
		expect(userDiaries(reg, 'bob')).toEqual([]);
	});

	it('deletes a diary with its database, memberships and invites', () => {
		const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-diary-'));
		try {
			const reg = openRegistry(':memory:');
			const id = createDiary(reg, 'Orchideen', 'objects', 'alice');
			openDb(diaryFile(dbDir, id)).close();
			const token = createInvite(reg, id, 'editor', 'alice');

			deleteDiary(reg, dbDir, id);

			expect(fs.existsSync(diaryFile(dbDir, id))).toBe(false);
			expect(userDiaries(reg, 'alice')).toEqual([]);
			expect(acceptInvite(reg, token, 'bob')).toBeUndefined();
		} finally {
			fs.rmSync(dbDir, { recursive: true, force: true });
		}
	});
});
