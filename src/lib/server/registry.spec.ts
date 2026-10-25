import { describe, expect, it } from 'vitest';
import { createDiary, memberDiary, openRegistry, userDiaries } from './registry.ts';

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
