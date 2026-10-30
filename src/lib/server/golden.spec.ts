import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { DIARY_SCHEMA, openDb } from './db.ts';
import { Diary, dump, view } from './testing/harness.ts';
import { buildScenario } from './testing/scenario.ts';

const TESTING = path.join(import.meta.dirname, 'testing');
const FIXTURES = fs.readdirSync(TESTING).filter((f) => /^diary-v\d+\.sql$/.test(f));

function built() {
	const db = openDb(':memory:');
	buildScenario(new Diary(db));
	return db;
}

it('shows the scenario as the snapshot says', async () => {
	await expect(`${JSON.stringify(view(built()), null, '\t')}\n`).toMatchFileSnapshot(
		'testing/diary.view.json'
	);
});

describe.each(FIXTURES)('the scenario kept as %s', (fixture) => {
	it('migrates to what a new diary shows', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-diary-'));
		try {
			const file = path.join(dir, 'diary.sqlite');
			const old = new DatabaseSync(file);
			old.exec(fs.readFileSync(path.join(TESTING, fixture), 'utf8'));
			old.close();
			expect(view(openDb(file))).toEqual(view(built()));
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});

it.runIf(process.env.WRITE_FIXTURE)('keeps the scenario at the current schema version', () => {
	const file = path.join(TESTING, `diary-v${DIARY_SCHEMA.version}.sql`);
	fs.writeFileSync(file, dump(built()), { flag: 'wx' });
	expect(fs.existsSync(file)).toBe(true);
});
