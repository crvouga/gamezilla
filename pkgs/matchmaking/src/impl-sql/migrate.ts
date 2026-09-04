/**
 * Portable matchmaking schema migrate (SQLite + Postgres).
 *
 * defineTable reconcile + fingerprint-driven waiting/partition rebuild.
 * Hosts drive `tick()`.
 */

import { assert } from '@pkgs/assert';
import { applyPostgresSchema } from '@pkgs/db-schema/postgres';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { isNamespacedKeyword } from '@pkgs/keyword';
import { isPostgresSqlClient } from '@pkgs/postgres-sqlite-compat';
import { raw, sql } from '@pkgs/sql';
import { getUnderlyingSqlClient } from '@pkgs/sql-client/impl-agnostic';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { cutoverMatchmakingTables } from '../cutover-migration';
import type { MatchmakingSchema } from '../interface/schema';
import { DEFAULT_RADIUS_OPTIONS, type RadiusOptions } from '../interface/types';
import {
  MATCHMAKING_ACTIVE_PARTITIONS_TABLE,
  MATCHMAKING_SCHEMA_STATE_ID,
  MATCHMAKING_WAITING_TABLE,
  matchmakingSchema,
} from '../schema/tables';

export type { MatchmakingSchema };

export type MigrateTuning = {
  readonly maxPairsPerPass?: number;
  readonly maxWaitSeconds?: number;
  readonly matchedRetentionSeconds?: number;
  readonly claimTtlMs?: number;
};

export type MigrateOptions = {
  readonly sqlClient: SqlClient;
  readonly schema?: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning?: MigrateTuning;
  /** Wall clock for managed timestamps (fingerprint upsert). */
  readonly now?: () => number;
};

/** Schema layout version for fingerprinting. */
const SCHEMA_VERSION = 8;

const DEFAULT_BUCKET_WIDTH = 50;

type ResolvedSchema = {
  readonly partitionKeys: readonly string[];
  readonly primaryNumericKey: string | undefined;
  readonly bucketWidth: number;
};

function resolveSchema(schema: MatchmakingSchema | undefined): ResolvedSchema {
  const partitionKeys = schema?.partitionKeys ?? [];
  assert.array(partitionKeys, 'migrate: schema.partitionKeys must be an array');
  for (const k of partitionKeys) {
    assert.nonEmptyString(
      k,
      'migrate: schema.partitionKeys entries must be non-empty strings'
    );
    assert.ok(
      isNamespacedKeyword(k),
      'migrate: partitionKeys must be namespaced keywords',
      { k }
    );
  }
  const primaryNumericKey = schema?.primaryNumericKey;
  if (primaryNumericKey !== undefined) {
    assert.nonEmptyString(
      primaryNumericKey,
      'migrate: schema.primaryNumericKey must be a non-empty string'
    );
    assert.ok(
      isNamespacedKeyword(primaryNumericKey),
      'migrate: primaryNumericKey must be a namespaced keyword',
      { primaryNumericKey }
    );
  }
  const bucketWidth = schema?.bucketWidth ?? DEFAULT_BUCKET_WIDTH;
  assert.ok(
    Number.isFinite(bucketWidth) && bucketWidth > 0,
    'migrate: schema.bucketWidth must be a positive finite number',
    { bucketWidth }
  );
  return { partitionKeys, primaryNumericKey, bucketWidth };
}

function fingerprintSchema(schema: ResolvedSchema): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    partitionKeys: schema.partitionKeys,
    primaryNumericKey: schema.primaryNumericKey ?? null,
    bucketWidth: schema.bucketWidth,
  });
}

export function fingerprintForOptions(
  schema: MatchmakingSchema | undefined
): string {
  return fingerprintSchema(resolveSchema(schema));
}

async function applyMatchmakingSchema(sqlClient: SqlClient): Promise<void> {
  // Schema reconcile uses PRAGMA / information_schema — unwrap agnostic gate.
  const engine = getUnderlyingSqlClient(sqlClient);
  if (await isPostgresSqlClient(engine)) {
    await applyPostgresSchema(
      engine,
      matchmakingSchema,
      createPostgresDbScope('public'),
      {
        skipAdvisoryLock: true,
        alreadyInTransaction: false,
      }
    );
    return;
  }
  await applySqliteSchema(engine, matchmakingSchema, {
    ownership: 'declared-only',
  });
}

async function rebuildWaitingTables(sqlClient: SqlClient): Promise<void> {
  // Ephemeral tick state — drop + reconcile recreate is intentional.
  const engine = getUnderlyingSqlClient(sqlClient);
  await engine.run(raw(`DROP TABLE IF EXISTS ${MATCHMAKING_WAITING_TABLE}`));
  await engine.run(
    raw(`DROP TABLE IF EXISTS ${MATCHMAKING_ACTIVE_PARTITIONS_TABLE}`)
  );
  await applyMatchmakingSchema(engine);
}

async function upsertSchemaFingerprint(
  sqlClient: SqlClient,
  fp: string,
  nowMs: number
): Promise<void> {
  const iso = new Date(nowMs).toISOString();
  await sqlClient.run(
    sql<void>`
      INSERT INTO matchmaking_schema_state (
        id, schema_fingerprint, created_at, updated_at, deleted_at
      )
      VALUES (
        ${MATCHMAKING_SCHEMA_STATE_ID},
        ${fp},
        ${iso},
        ${iso},
        ${null}
      )
      ON CONFLICT (id) DO UPDATE
        SET schema_fingerprint = excluded.schema_fingerprint,
            updated_at = excluded.updated_at,
            deleted_at = NULL`
  );
}

async function maybeRebuildSchema(
  sqlClient: SqlClient,
  schema: ResolvedSchema,
  nowMs: number
): Promise<void> {
  const fp = fingerprintSchema(schema);
  const state = await sqlClient.query(
    sql<{ schema_fingerprint: string }>`
      SELECT schema_fingerprint
        FROM matchmaking_schema_state
       WHERE id = ${MATCHMAKING_SCHEMA_STATE_ID}
         AND deleted_at IS NULL`
  );
  const currentFp = state[0]?.schema_fingerprint ?? null;
  if (currentFp === fp) return;
  // Fresh install: tables already applied — only record fingerprint.
  // Rebuild only when an existing fingerprint differs (schema change).
  if (currentFp !== null) {
    await rebuildWaitingTables(sqlClient);
  }
  await upsertSchemaFingerprint(sqlClient, fp, nowMs);
}

/** Serialize concurrent ready()/migrate on shared DBs (Postgres CHECK races). */
let migrateChain: Promise<void> = Promise.resolve();

/**
 * Idempotent schema install for both SQLite and Postgres.
 */
export async function migrate(opts: MigrateOptions): Promise<void> {
  assert.defined(opts, 'migrate: options required');
  assert.defined(opts.sqlClient, 'migrate: sqlClient required');
  const run = (): Promise<void> => migrateInner(opts);
  const next = migrateChain.then(s, run);
  migrateChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function migrateInner(opts: MigrateOptions): Promise<void> {
  const schema = resolveSchema(opts.schema);
  // radius / tuning are accepted for API compatibility but no longer baked
  // into SQL functions — matching runs in the app layer.
  void opts.radius;
  void opts.tuning;
  void DEFAULT_RADIUS_OPTIONS;

  const { sqlClient } = opts;
  const nowMs = opts.now?.() ?? 0;
  const engine = getUnderlyingSqlClient(sqlClient);
  await cutoverMatchmakingTables(engine);
  await applyMatchmakingSchema(engine);
  await maybeRebuildSchema(sqlClient, schema, nowMs);
}
