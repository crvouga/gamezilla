import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { unsafe } from '@pkgs/sql-shared/sql';

import {
  SYNC_ENGINE_MUTATIONS,
  syncEngineLocalSchema,
} from '@pkgs/sync-engine-shared/tables';

/** Bump to wipe CACHE tables on next open (hard-cutoff schema change). */
export const SCHEMA_EPOCH = 12;

/** Retired local tables dropped on epoch migrate (legacy + pre-prefix names). */
export const RETIRED_LOCAL_TABLES = [
  '_row_scopes',
  '_upload_state',
  '_peer_applied',
  '_peer_mutations',
  '_topic_applied',
  '_mutations',
  '_mutations_applied',
  'write_rejections',
  '_scope_meta',
  '_push_applied',
  '_sync_topic_seq',
  'inbox_interactions',
  'inbox_preferences',
  'inbox_schema_state',
] as const;

async function backfillLocalMutationColumns(db: SqlClient): Promise<void> {
  const cols = await db.query(
    unsafe<{ name: string }>(`PRAGMA table_info("${SYNC_ENGINE_MUTATIONS}")`)
  );
  if (cols.length === 0) return;
  const names = new Set(cols.map((c) => c.name));
  if (names.has('updated_at')) {
    await db.run(
      unsafe(`
        UPDATE ${SYNC_ENGINE_MUTATIONS}
        SET updated_at = created_at
        WHERE updated_at IS NULL AND created_at IS NOT NULL
      `)
    );
  }
}

/** Apply local framework defineTable schema (declared-only ownership). */
export async function ensureFrameworkSchema(db: SqlClient): Promise<void> {
  await reconcileSqliteSchema(db, syncEngineLocalSchema, {
    ownership: 'declared-only',
  });
  await backfillLocalMutationColumns(db);
}
