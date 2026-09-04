import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { KV_TABLE } from '@pkgs/kv/schema/tables';
import { unsafe } from '@pkgs/sql';

/**
 * Rebuild `kv` from PK `key` to managed `id` + jsonb `value`.
 * Source `value` may be text or jsonb; copy always goes through `value::text`.
 */
export class KvCutoverMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    if (!(await tableExists(ctx))) {
      ctx.logger.info('kv cutover: table missing (fresh)');
      return;
    }
    if (!(await kvNeedsRebuild(ctx))) {
      await dropNotNull(ctx);
      ctx.logger.info('kv cutover: already typed');
      return;
    }
    await rebuildKv(ctx);
  }
}

async function tableExists(ctx: DatabaseMigrationContext): Promise<boolean> {
  const rows = await ctx.sqlClient.query<{ one: number }>(
    unsafe(`
      SELECT 1 AS one
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = '${KV_TABLE}'
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
        AND table_name = '${KV_TABLE}'
        AND column_name = '${column}'
      LIMIT 1
    `)
  );
  return rows[0]?.udt_name ?? null;
}

async function kvNeedsRebuild(ctx: DatabaseMigrationContext): Promise<boolean> {
  const hasId = (await columnUdt(ctx, 'id')) !== null;
  const value = await columnUdt(ctx, 'value');
  return !hasId || value !== 'jsonb';
}

async function rebuildKv(ctx: DatabaseMigrationContext): Promise<void> {
  const next = `${KV_TABLE}_next`;
  await ctx.sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${next}`));
  await ctx.sqlClient.run(
    unsafe(`
      CREATE TABLE ${next} (
        id text PRIMARY KEY,
        key text,
        value jsonb,
        created_at timestamptz,
        updated_at timestamptz,
        deleted_at timestamptz
      )
    `)
  );
  await ctx.sqlClient.run(
    unsafe(`
      CREATE OR REPLACE FUNCTION _kv_cutover_jsonb(src text) RETURNS jsonb
      LANGUAGE plpgsql IMMUTABLE AS $fn$
      BEGIN
        IF src IS NULL OR btrim(src) = '' THEN
          RETURN NULL;
        END IF;
        RETURN src::jsonb;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN to_jsonb(src);
      END;
      $fn$
    `)
  );
  await copyKvRows(ctx, next);
  await ctx.sqlClient.run(
    unsafe('DROP FUNCTION IF EXISTS _kv_cutover_jsonb(text)')
  );
  await ctx.sqlClient.run(unsafe(`DROP TABLE ${KV_TABLE} CASCADE`));
  await ctx.sqlClient.run(unsafe(`ALTER TABLE ${next} RENAME TO ${KV_TABLE}`));
  ctx.logger.info('kv cutover: rebuilt with id PK + jsonb value');
}

async function copyKvRows(
  ctx: DatabaseMigrationContext,
  next: string
): Promise<void> {
  const hasId = (await columnUdt(ctx, 'id')) !== null;
  const idExpr = hasId ? 'id' : 'key';
  const createdAt = await timestampCopyExpr(
    ctx,
    'created_at',
    'last_modified_at'
  );
  const updatedAt = await timestampCopyExpr(
    ctx,
    'updated_at',
    'last_modified_at'
  );
  const deletedAt =
    (await columnUdt(ctx, 'deleted_at')) !== null
      ? 'deleted_at::timestamptz'
      : 'NULL';
  await ctx.sqlClient.run(
    unsafe(`
      INSERT INTO ${next} (id, key, value, created_at, updated_at, deleted_at)
      SELECT
        ${idExpr},
        key,
        _kv_cutover_jsonb(value::text),
        ${createdAt},
        ${updatedAt},
        ${deletedAt}
      FROM ${KV_TABLE}
    `)
  );
}

async function timestampCopyExpr(
  ctx: DatabaseMigrationContext,
  column: string,
  fallback: string
): Promise<string> {
  if ((await columnUdt(ctx, column)) !== null) {
    return `${column}::timestamptz`;
  }
  if ((await columnUdt(ctx, fallback)) !== null) {
    return `${fallback}::timestamptz`;
  }
  return 'NULL';
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
