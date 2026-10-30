import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalize } from '../suggest.ts';
export type Db = DatabaseSync;

export type DataDirs = { dbDir: string; photosDir: string; preMigrationDir: string };

/** A function fixes data where SQL alone can't. */
export type Migration = string | ((db: Db, dirs: DataDirs) => void | Promise<void>);

/**
 * `create` builds a new database at `version`. `migrations[v]` brings an existing one from
 * v - 1 to v.
 */
export type Schema = { version: number; create: string; migrations: Record<number, Migration> };

function connect(file: string): Db {
	const db = new DatabaseSync(file, { timeout: 5000 });
	db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
	db.function('normalized', { deterministic: true }, (s) => normalize(String(s ?? '')));
	return db;
}

function userVersion(db: Db): number {
	return (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

/** Never migrates. `migrateDb` does that before the app serves its first request. */
export function openDb(file: string, schema: Schema): Db {
	if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
	const db = connect(file);
	const version = userVersion(db);
	if (version === 0) {
		transaction(db, () => {
			db.exec(schema.create);
			db.exec(`PRAGMA user_version = ${schema.version}`);
		});
	} else if (version !== schema.version) {
		db.close();
		throw new Error(`${file} is at version ${version}, but this app needs ${schema.version}`);
	}
	return db;
}

/** Keeps a copy of the database as it was before, under `preMigrationDir`. */
export async function migrateDb(file: string, schema: Schema, dirs: DataDirs) {
	if (!fs.existsSync(file)) return;
	const db = connect(file);
	try {
		const from = userVersion(db);
		if (from === 0 || from === schema.version) return;
		if (from > schema.version) {
			throw new Error(`${file} is at version ${from}, newer than this app (${schema.version})`);
		}
		const copy = path
			.join(dirs.preMigrationDir, path.relative(dirs.dbDir, file))
			.replace(/\.sqlite$/, `.v${from}.sqlite`);
		fs.mkdirSync(path.dirname(copy), { recursive: true });
		fs.rmSync(copy, { force: true });
		db.prepare('VACUUM INTO ?').run(copy);

		// Foreign keys are off so migrations can rebuild tables the way SQLite documents.
		// The foreign_key_check below stands in for them.
		db.exec('PRAGMA foreign_keys = OFF');
		for (let v = from + 1; v <= schema.version; v++) {
			const migration = schema.migrations[v];
			if (migration === undefined) {
				throw new Error(`${file} is at version ${from}, too old to be migrated`);
			}
			db.exec('BEGIN IMMEDIATE');
			try {
				if (typeof migration === 'string') db.exec(migration);
				else await migration(db, dirs);
				if (db.prepare('PRAGMA foreign_key_check').all().length) {
					throw new Error(`Migration ${v} would break references between tables`);
				}
				db.exec(`PRAGMA user_version = ${v}`);
				db.exec('COMMIT');
			} catch (e) {
				db.exec('ROLLBACK');
				throw e;
			}
		}
	} finally {
		db.close();
	}
}

/** Inside another transaction, `fn` becomes part of it. */
export function transaction<T>(db: Db, fn: () => T): T {
	if (db.isTransaction) return fn();
	db.exec('BEGIN IMMEDIATE');
	try {
		const result = fn();
		db.exec('COMMIT');
		return result;
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
}
