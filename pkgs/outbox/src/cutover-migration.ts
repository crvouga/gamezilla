import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { unsafe } from '@pkgs/sql';

import { OUTBOX_DELIVERIES_TABLE, OUTBOX_EVENTS_TABLE } from './schema/tables';

/**
 * One-shot Postgres cutover from raw outbox DDL to defineTable shape:
 * rebuild events from TEXT onto jsonb/timestamptz; rebuild deliveries with
 * TEXT `id` PK. No-op when tables are missing (fresh DB).
 */
export class OutboxCutoverMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await cutoverEvents(ctx);
    await cutoverDeliveries(ctx);
  }
}

async function tableExists(
  ctx: DatabaseMigrationContext,
  name: string
): Promise<boolean> {
  const rows = await ctx.sqlClient.query<{ one: number }>(
    unsafe(`
      SELECT 1 AS one
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = '${name}'
      LIMIT 1
    `)
  );
  return rows.length > 0;
}

async function hasColumn(
  ctx: DatabaseMigrationContext,
  table: string,
  column: string
): Promise<boolean> {
  return (await columnUdt(ctx, table, column)) !== null;
}

async function columnUdt(
  ctx: DatabaseMigrationContext,
  table: string,
  column: string
): Promise<string | null> {
  const rows = await ctx.sqlClient.query<{ udt_name: string }>(
    unsafe(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = '${table}'
        AND column_name = '${column}'
      LIMIT 1
    `)
  );
  return rows[0]?.udt_name ?? null;
}

async function dropNotNullNonPk(
  ctx: DatabaseMigrationContext,
  table: string
): Promise<void> {
  await ctx.sqlClient.run(
    unsafe(`
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = '${table}'
      AND c.is_nullable = 'NO'
      AND c.column_name <> 'id'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL',
      '${table}',
      r.column_name
    );
  END LOOP;
END $$;
`)
  );
}

async function cutoverEvents(ctx: DatabaseMigrationContext): Promise<void> {
  if (!(await tableExists(ctx, OUTBOX_EVENTS_TABLE))) {
    ctx.logger.info('outbox cutover: outbox_events missing (fresh)');
    return;
  }
  if (!(await outboxEventsNeedsRebuild(ctx))) {
    await dropNotNullNonPk(ctx, OUTBOX_EVENTS_TABLE);
    ctx.logger.info('outbox cutover: outbox_events already typed');
    return;
  }
  await rebuildOutboxEvents(ctx);
}

async function outboxEventsNeedsRebuild(
  ctx: DatabaseMigrationContext
): Promise<boolean> {
  const payload = await columnUdt(ctx, OUTBOX_EVENTS_TABLE, 'payload');
  const createdAt = await columnUdt(ctx, OUTBOX_EVENTS_TABLE, 'created_at');
  const availableAt = await columnUdt(ctx, OUTBOX_EVENTS_TABLE, 'available_at');
  return (
    payload !== 'jsonb' ||
    createdAt !== 'timestamptz' ||
    availableAt !== 'timestamptz'
  );
}

async function rebuildOutboxEvents(
  ctx: DatabaseMigrationContext
): Promise<void> {
  const table = OUTBOX_EVENTS_TABLE;
  const next = `${table}_next`;
  await ctx.sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${next}`));
  await ctx.sqlClient.run(
    unsafe(`
      CREATE TABLE ${next} (
        id text PRIMARY KEY,
        type text,
        payload jsonb,
        available_at timestamptz,
        created_at timestamptz,
        updated_at timestamptz,
        deleted_at timestamptz
      )
    `)
  );
  await copyOutboxEventRows(ctx, next);
  await ctx.sqlClient.run(unsafe(`DROP TABLE ${table} CASCADE`));
  await ctx.sqlClient.run(unsafe(`ALTER TABLE ${next} RENAME TO ${table}`));
  ctx.logger.info('outbox cutover: outbox_events rebuilt');
}

async function copyOutboxEventRows(
  ctx: DatabaseMigrationContext,
  next: string
): Promise<void> {
  const table = OUTBOX_EVENTS_TABLE;
  const updatedAt = (await hasColumn(ctx, table, 'updated_at'))
    ? 'COALESCE(updated_at::timestamptz, created_at::timestamptz)'
    : 'created_at::timestamptz';
  const deletedAt = (await hasColumn(ctx, table, 'deleted_at'))
    ? 'deleted_at::timestamptz'
    : 'NULL';
  await ctx.sqlClient.run(
    unsafe(`
      INSERT INTO ${next} (
        id, type, payload, available_at, created_at, updated_at, deleted_at
      )
      SELECT
        id, type,
        CASE
          WHEN btrim(COALESCE(payload::text, '')) = '' THEN NULL
          ELSE payload::text::jsonb
        END,
        available_at::timestamptz,
        created_at::timestamptz,
        ${updatedAt},
        ${deletedAt}
      FROM ${table}
    `)
  );
}

async function cutoverDeliveries(ctx: DatabaseMigrationContext): Promise<void> {
  if (!(await tableExists(ctx, OUTBOX_DELIVERIES_TABLE))) {
    ctx.logger.info('outbox cutover: outbox_deliveries missing (fresh)');
    return;
  }
  if (await hasColumn(ctx, OUTBOX_DELIVERIES_TABLE, 'id')) {
    await dropNotNullNonPk(ctx, OUTBOX_DELIVERIES_TABLE);
    ctx.logger.info('outbox cutover: outbox_deliveries already has id');
    return;
  }

  const next = `${OUTBOX_DELIVERIES_TABLE}_next`;
  await ctx.sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${next}`));
  await ctx.sqlClient.run(
    unsafe(`
      CREATE TABLE ${next} (
        id text PRIMARY KEY,
        event_id text,
        consumer_id text,
        attempts bigint,
        available_at timestamptz,
        processed_at timestamptz,
        last_error text,
        created_at timestamptz,
        updated_at timestamptz,
        deleted_at timestamptz
      )
    `)
  );
  await ctx.sqlClient.run(
    unsafe(`
      INSERT INTO ${next} (
        id, event_id, consumer_id, attempts, available_at, processed_at,
        last_error, created_at, updated_at, deleted_at
      )
      SELECT
        event_id || ':' || consumer_id,
        event_id,
        consumer_id,
        attempts,
        available_at::timestamptz,
        processed_at::timestamptz,
        last_error,
        COALESCE(available_at::timestamptz, available_at::timestamptz),
        COALESCE(available_at::timestamptz, available_at::timestamptz),
        NULL
      FROM ${OUTBOX_DELIVERIES_TABLE}
    `)
  );
  await ctx.sqlClient.run(
    unsafe(`DROP TABLE ${OUTBOX_DELIVERIES_TABLE} CASCADE`)
  );
  await ctx.sqlClient.run(
    unsafe(`ALTER TABLE ${next} RENAME TO ${OUTBOX_DELIVERIES_TABLE}`)
  );
  ctx.logger.info('outbox cutover: outbox_deliveries rebuilt with id PK');
}
