import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from './db.ts';
import {
	adoptLegacyDiary,
	createDiary,
	diaryFile,
	legacyDiaryFile,
	memberDiary,
	openRegistry,
	userDiaries
} from './registry.ts';

const dirs: string[] = [];
function tempDir() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plant-diary-'));
	dirs.push(dir);
	return dir;
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('diaries and members', () => {
	it('gives each user only their own diaries', () => {
		const reg = openRegistry(':memory:');
		const alice = createDiary(reg, 'Pflanzentagebuch', 'plants', 'alice');
		const bob = createDiary(reg, 'Pflanzentagebuch', 'plants', 'bob');

		expect(alice).toBe('pflanzentagebuch');
		expect(bob).toBe('pflanzentagebuch-2');
		expect(userDiaries(reg, 'alice').map((d) => d.id)).toEqual([alice]);
		expect(memberDiary(reg, alice, 'alice')).toMatchObject({ role: 'owner', type: 'plants' });
		expect(memberDiary(reg, alice, 'bob')).toBeUndefined();
	});

	it('makes readable, unique IDs that do not collide with app paths', () => {
		const reg = openRegistry(':memory:');
		expect(createDiary(reg, 'Hausbau Küche & Bad', 'plants', 'a')).toBe('hausbau-kueche-bad');
		expect(createDiary(reg, 'Login', 'plants', 'a')).toBe('login-2');
		expect(createDiary(reg, '!!!', 'plants', 'a')).toBe('tagebuch');
	});
});

describe('adoptLegacyDiary', () => {
	it('moves the data from before diaries existed into a diary of the chosen owner', () => {
		const dbDir = tempDir();
		const legacy = openDb(legacyDiaryFile(dbDir));
		legacy.prepare("INSERT INTO plants (id, name) VALUES ('ORC-001', 'Dendrobium')").run();
		legacy.close();
		const reg = openRegistry(':memory:');

		const id = adoptLegacyDiary(reg, dbDir, 'alice', 'Orchideen-Tagebuch');

		expect(fs.existsSync(legacyDiaryFile(dbDir))).toBe(false);
		expect(userDiaries(reg, 'alice')).toEqual([
			{ id: 'orchideen-tagebuch', name: 'Orchideen-Tagebuch', type: 'plants', role: 'owner' }
		]);
		const diary = openDb(diaryFile(dbDir, id));
		expect(diary.prepare('SELECT name FROM plants').get()).toEqual({ name: 'Dendrobium' });
		diary.close();
		expect(() => adoptLegacyDiary(reg, dbDir, 'bob', 'x')).toThrow();
	});
});
