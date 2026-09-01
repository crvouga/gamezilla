import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { unsafe } from '@pkgs/sql';

import { KV_TABLE } from './schema/tables';

/**
 * Rebuild `kv` from PK `key` to managed `id` (+ timestamps/`deleted_at`).
 * No-op when table missing or already has managed `id`.
 */
export class KvCutoverMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const existing = await ctx.sqlClient.query<{ one: number }>(
      unsafe(`
        SELECT 1 AS one
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = '${KV_TABLE}'
        LIMIT 1
      `)
    );
    if (existing.length === 0) {
      ctx.logger.info('kv cutover: table missing (fresh)');
      return;
    }

    const hasId = await ctx.sqlClient.query<{ one: number }>(
      unsafe(`
        SELECT 1 AS one
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = '${KV_TABLE}'
          AND column_name = 'id'
        LIMIT 1
      `)
    );
    if (hasId.length > 0) {
      await dropNotNull(ctx);
      ctx.logger.info('kv cutover: already has id');
      return;
    }

    const next = `${KV_TABLE}_next`;
    await ctx.sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${next}`));
    await ctx.sqlClient.run(
      unsafe(`
        CREATE TABLE ${next} (
          id text PRIMARY KEY,
          key text,
          value text,
          created_at timestamptz,
          updated_at timestamptz,
          deleted_at timestamptz
        )
      `)
    );
    const hasLastMod = await ctx.sqlClient.query<{ one: number }>(
      unsafe(`
        SELECT 1 AS one
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = '${KV_TABLE}'
          AND column_name = 'last_modified_at'
        LIMIT 1
      `)
    );
    if (hasLastMod.length > 0) {
      await ctx.sqlClient.run(
        unsafe(`
          INSERT INTO ${next} (id, key, value, created_at, updated_at, deleted_at)
          SELECT
            key,
            key,
            value,
            last_modified_at::timestamptz,
            last_modified_at::timestamptz,
            NULL
          FROM ${KV_TABLE}
        `)
      );
    } else {
      await ctx.sqlClient.run(
        unsafe(`
          INSERT INTO ${next} (id, key, value, created_at, updated_at, deleted_at)
          SELECT key, key, value, NULL, NULL, NULL FROM ${KV_TABLE}
        `)
      );
    }
    await ctx.sqlClient.run(unsafe(`DROP TABLE ${KV_TABLE} CASCADE`));
    await ctx.sqlClient.run(
      unsafe(`ALTER TABLE ${next} RENAME TO ${KV_TABLE}`)
    );
    ctx.logger.info('kv cutover: rebuilt with id PK');
  }
}

async function dropNotNull(ctx: DatabaseMigrationContext): Promise<void> {
  await ctx.sqlClient.run(
    unsafe(`
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = '${KV_TABLE}'
      AND c.is_nullable = 'NO'
      AND c.column_name <> 'id'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL',
      '${KV_TABLE}',
      r.column_name
    );
  END LOOP;
END $$;
`)
  );
}
