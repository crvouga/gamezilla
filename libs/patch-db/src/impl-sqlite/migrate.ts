import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PATCH_META_KEYS, PATCH_META_LEGACY_KEY_MAP } from '../interface';
import { MIGRATIONS } from './sql-constants';

async function runBaseMigrations(sqlClient: SqlClient): Promise<void> {
  const statements = MIGRATIONS.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await sqlClient.run(stmt);
  }
}

async function dropLegacyLineageDepth(sqlClient: SqlClient): Promise<void> {
  try {
    await sqlClient.run('ALTER TABLE patches DROP COLUMN lineage_depth');
  } catch {
    // Forward-compatible: old schema may not have lineage_depth; new DBs skip.
  }
}

async function dropLegacyLineageIndex(sqlClient: SqlClient): Promise<void> {
  try {
    await sqlClient.run('DROP INDEX IF EXISTS idx_patches_entity_type_lineage');
  } catch {
    // Forward-compatible: index may be absent on fresh DB or already removed.
  }
}

async function migrateLegacyMetadataColumn(
  sqlClient: SqlClient
): Promise<void> {
  try {
    const tableInfo = await sqlClient.query<{ name: string }>(
      "SELECT name FROM pragma_table_info('patches') WHERE name = 'metadata'"
    );
    if (tableInfo.length === 0) return;
    const jsonSetArgs = (PATCH_META_KEYS as readonly string[])
      .flatMap((attrKey) => {
        const legacyKey = PATCH_META_LEGACY_KEY_MAP[attrKey];
        const path = `'$.${attrKey.replace(/"/g, '""')}'`;
        const expr =
          attrKey === 'patch/syncedAt'
            ? `json_extract(metadata, '$.${legacyKey}')`
            : `coalesce(json_extract(metadata, '$.${legacyKey}'), '')`;
        return [path, expr];
      })
      .join(', ');
    await sqlClient.run(
      `UPDATE patches SET attributes = json_set(attributes, ${jsonSetArgs})`
    );
    await sqlClient.run('ALTER TABLE patches DROP COLUMN metadata');
  } catch {
    // Forward-compatible: metadata column exists only in pre-migration DBs.
  }
}

/** Applies base DDL + forward-compatible cleanups for legacy columns. */
export async function migratePatchDbSqlite(
  sqlClient: SqlClient
): Promise<void> {
  await runBaseMigrations(sqlClient);
  await dropLegacyLineageDepth(sqlClient);
  await dropLegacyLineageIndex(sqlClient);
  await migrateLegacyMetadataColumn(sqlClient);
}
