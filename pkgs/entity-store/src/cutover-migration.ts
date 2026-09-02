import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { unsafe } from '@pkgs/sql';

import { ENTITY_STORE_TABLE } from './schema/tables';

/**
 * One-shot cutover: drop NOT NULL, rebuild TEXT `data` onto jsonb so
 * PostgresSchema reconcile matches defineTable. No-op on fresh DBs.
 */
export class EntityStoreCutoverMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    if (!(await tableExists(ctx))) {
      ctx.logger.info('entity_store cutover: table missing (fresh DB)');
      return;
    }
    if (!(await entityStoreNeedsRebuild(ctx))) {
      await dropNotNull(ctx);
      ctx.logger.info('entity_store cutover: already typed');
      return;
    }
    await rebuildEntityStore(ctx);
  }
}

async function tableExists(ctx: DatabaseMigrationContext): Promise<boolean> {
  const rows = await ctx.sqlClient.query<{ one: number }>(
    unsafe(`
      SELECT 1 AS one
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = '${ENTITY_STORE_TABLE}'
      LIMIT 1
    `)
  );
  return rows.length > 0;
}

async function columnUdt(
  ctx: DatabaseMigrationContext,
  column: string
): Promise<string | null> {
  const rows = await ctx.sqlClient.query<{ udt_name: string }>(
    unsafe(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = '${ENTITY_STORE_TABLE}'
        AND column_name = '${column}'
      LIMIT 1
    `)
  );
  return rows[0]?.udt_name ?? null;
}

async function entityStoreNeedsRebuild(
  ctx: DatabaseMigrationContext
): Promise<boolean> {
  const data = await columnUdt(ctx, 'data');
  const createdAt = await columnUdt(ctx, 'created_at');
  return data !== 'jsonb' || createdAt !== 'timestamptz';
}

async function rebuildEntityStore(
  ctx: DatabaseMigrationContext
): Promise<void> {
  const table = ENTITY_STORE_TABLE;
  const next = `${table}_next`;
  await ctx.sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${next}`));
  await ctx.sqlClient.run(
    unsafe(`
      CREATE TABLE ${next} (
        id text PRIMARY KEY,
        namespace text,
        type text,
        external_id text,
        owner_id text,
        data jsonb,
        created_at timestamptz,
        updated_at timestamptz,
        deleted_at timestamptz
      )
    `)
  );
  await copyEntityStoreRows(ctx, next);
  await ctx.sqlClient.run(unsafe(`DROP TABLE ${table} CASCADE`));
  await ctx.sqlClient.run(unsafe(`ALTER TABLE ${next} RENAME TO ${table}`));
  ctx.logger.info('entity_store cutover: rebuilt onto jsonb/timestamptz');
}

async function copyEntityStoreRows(
  ctx: DatabaseMigrationContext,
  next: string
): Promise<void> {
  const table = ENTITY_STORE_TABLE;
  const updatedAt =
    (await columnUdt(ctx, 'updated_at')) !== null
      ? 'COALESCE(updated_at::timestamptz, created_at::timestamptz)'
      : 'created_at::timestamptz';
  const deletedAt =
    (await columnUdt(ctx, 'deleted_at')) !== null
      ? 'deleted_at::timestamptz'
      : 'NULL';
  await ctx.sqlClient.run(
    unsafe(`
      INSERT INTO ${next} (
        id, namespace, type, external_id, owner_id, data,
        created_at, updated_at, deleted_at
      )
      SELECT
        id, namespace, type, external_id, owner_id,
        CASE
          WHEN btrim(COALESCE(data, '')) = '' THEN NULL
          ELSE data::jsonb
        END,
        created_at::timestamptz,
        ${updatedAt},
        ${deletedAt}
      FROM ${table}
    `)
  );
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
      AND c.table_name = '${ENTITY_STORE_TABLE}'
      AND c.is_nullable = 'NO'
      AND c.column_name <> 'id'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL',
      '${ENTITY_STORE_TABLE}',
      r.column_name
    );
  END LOOP;
END $$;
`)
  );
}
