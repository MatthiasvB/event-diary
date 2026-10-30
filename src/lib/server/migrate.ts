import { config } from './config.ts';
import { migrateDb, type DataDirs } from './db.ts';
import { DIARY_SCHEMA } from './diarySchema.ts';
import { diaryFile, diaryIds, openRegistry, REGISTRY_SCHEMA, registryFile } from './registry.ts';

export async function migrateAll(dirs: DataDirs) {
	const registry = registryFile(dirs.dbDir);
	await migrateDb(registry, REGISTRY_SCHEMA, dirs);
	const reg = openRegistry(registry);
	const ids = diaryIds(reg);
	reg.close();
	for (const id of ids) await migrateDb(diaryFile(dirs.dbDir, id), DIARY_SCHEMA, dirs);
}

if (import.meta.main) await migrateAll(config);
