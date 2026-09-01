import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { unsafe } from '@pkgs/sql';

import {
  SYNC_ENGINE_MUTATIONS,
  SYNC_ENGINE_MUTATIONS_APPLIED,
  SYNC_ENGINE_TOPIC_SEQ,
  SYNC_ENGINE_WRITE_REJECTIONS,
} from './shared/schema/tables';

const LEGACY_SERVER_QUEUE_TABLES = ['_mutations'] as const;

/**
 * One-shot Postgres cutover from raw framework DDL to defineTable shape:
 * drop legacy server queue tables, rebuild topic/mutation-id PK tables with
 * managed `id`, add managed columns on write_rejections.
 */
export class SyncEngineCutoverMigration implements DatabaseMigration {
  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await dropLegacyServerQueue(ctx);
    await cutoverMutationsApplied(ctx);
    await cutoverWriteRejections(ctx);
    await cutoverTopicSeq(ctx);
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
  const rows = await ctx.sqlClient.query<{ one: number }>(
    unsafe(`
      SELECT 1 AS one
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = '${table}'
        AND column_name = '${column}'
      LIMIT 1
    `)
  );
  return rows.length > 0;
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

async function dropLegacyServerQueue(
  ctx: DatabaseMigrationContext
): Promise<void> {
  for (const table of [SYNC_ENGINE_MUTATIONS, ...LEGACY_SERVER_QUEUE_TABLES]) {
    await ctx.sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${table} CASCADE`));
  }
  ctx.logger.info('sync-engine cutover: dropped legacy server queue tables');
}

async function cutoverMutationsApplied(
  ctx: DatabaseMigrationContext
): Promise<void> {
  if (!(await tableExists(ctx, SYNC_ENGINE_MUTATIONS_APPLIED))) {
    ctx.logger.info('sync-engine cutover: mutations_applied missing (fresh)');
    return;
  }
  if (await hasColumn(ctx, SYNC_ENGINE_MUTATIONS_APPLIED, 'id')) {
    await dropNotNullNonPk(ctx, SYNC_ENGINE_MUTATIONS_APPLIED);
    ctx.logger.info('sync-engine cutover: mutations_applied already has id');
    return;
  }

  const next = `${SYNC_ENGINE_MUTATIONS_APPLIED}_next`;
  await ctx.sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${next}`));
  await ctx.sqlClient.run(
    unsafe(`
      CREATE TABLE ${next} (
        id text PRIMARY KEY,
        mutation_id text,
        client_id text,
        seq bigint,
        status text,
        created_at timestamptz,
        updated_at timestamptz,
        deleted_at timestamptz
      )
    `)
  );
  const hasAppliedAt = await hasColumn(
    ctx,
    SYNC_ENGINE_MUTATIONS_APPLIED,
    'applied_at'
  );
  if (hasAppliedAt) {
    await ctx.sqlClient.run(
      unsafe(`
        INSERT INTO ${next} (
          id, mutation_id, client_id, seq, status,
          created_at, updated_at, deleted_at
        )
        SELECT
          mutation_id,
          mutation_id,
          client_id,
          seq,
          status,
          applied_at::timestamptz,
          applied_at::timestamptz,
          NULL
        FROM ${SYNC_ENGINE_MUTATIONS_APPLIED}
      `)
    );
  } else {
    await ctx.sqlClient.run(
      unsafe(`
        INSERT INTO ${next} (
          id, mutation_id, client_id, seq, status,
          created_at, updated_at, deleted_at
        )
        SELECT
          mutation_id,
          mutation_id,
          client_id,
          seq,
          status,
          NULL,
          NULL,
          NULL
        FROM ${SYNC_ENGINE_MUTATIONS_APPLIED}
      `)
    );
  }
  await ctx.sqlClient.run(
    unsafe(`DROP TABLE ${SYNC_ENGINE_MUTATIONS_APPLIED} CASCADE`)
  );
  await ctx.sqlClient.run(
    unsafe(`ALTER TABLE ${next} RENAME TO ${SYNC_ENGINE_MUTATIONS_APPLIED}`)
  );
  ctx.logger.info('sync-engine cutover: mutations_applied rebuilt with id PK');
}

async function cutoverWriteRejections(
  ctx: DatabaseMigrationContext
): Promise<void> {
  if (!(await tableExists(ctx, SYNC_ENGINE_WRITE_REJECTIONS))) {
    ctx.logger.info('sync-engine cutover: write_rejections missing (fresh)');
    return;
  }
  await dropNotNullNonPk(ctx, SYNC_ENGINE_WRITE_REJECTIONS);
  if (!(await hasColumn(ctx, SYNC_ENGINE_WRITE_REJECTIONS, 'updated_at'))) {
    await ctx.sqlClient.run(
      unsafe(
        `ALTER TABLE ${SYNC_ENGINE_WRITE_REJECTIONS} ADD COLUMN IF NOT EXISTS updated_at text`
      )
    );
    await ctx.sqlClient.run(
      unsafe(`
        UPDATE ${SYNC_ENGINE_WRITE_REJECTIONS}
        SET updated_at = created_at
        WHERE updated_at IS NULL
      `)
    );
  }
  if (!(await hasColumn(ctx, SYNC_ENGINE_WRITE_REJECTIONS, 'deleted_at'))) {
    await ctx.sqlClient.run(
      unsafe(
        `ALTER TABLE ${SYNC_ENGINE_WRITE_REJECTIONS} ADD COLUMN IF NOT EXISTS deleted_at text`
      )
    );
  }
  ctx.logger.info('sync-engine cutover: write_rejections ready');
}

async function cutoverTopicSeq(ctx: DatabaseMigrationContext): Promise<void> {
  if (!(await tableExists(ctx, SYNC_ENGINE_TOPIC_SEQ))) {
    ctx.logger.info('sync-engine cutover: topic_seq missing (fresh)');
    return;
  }
  if (await hasColumn(ctx, SYNC_ENGINE_TOPIC_SEQ, 'id')) {
    await dropNotNullNonPk(ctx, SYNC_ENGINE_TOPIC_SEQ);
    ctx.logger.info('sync-engine cutover: topic_seq already has id');
    return;
  }

  const next = `${SYNC_ENGINE_TOPIC_SEQ}_next`;
  await ctx.sqlClient.run(unsafe(`DROP TABLE IF EXISTS ${next}`));
  await ctx.sqlClient.run(
    unsafe(`
      CREATE TABLE ${next} (
        id text PRIMARY KEY,
        topic text,
        n bigint,
        created_at timestamptz,
        updated_at timestamptz,
        deleted_at timestamptz
      )
    `)
  );
  await ctx.sqlClient.run(
    unsafe(`
      INSERT INTO ${next} (id, topic, n, created_at, updated_at, deleted_at)
      SELECT topic, topic, n, NULL, NULL, NULL
      FROM ${SYNC_ENGINE_TOPIC_SEQ}
    `)
  );
  await ctx.sqlClient.run(
    unsafe(`DROP TABLE ${SYNC_ENGINE_TOPIC_SEQ} CASCADE`)
  );
  await ctx.sqlClient.run(
    unsafe(`ALTER TABLE ${next} RENAME TO ${SYNC_ENGINE_TOPIC_SEQ}`)
  );
  ctx.logger.info('sync-engine cutover: topic_seq rebuilt with id PK');
}
