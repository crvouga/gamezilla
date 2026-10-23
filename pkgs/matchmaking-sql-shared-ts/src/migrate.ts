/**
 * Portable matchmaking schema migrate (SQLite + Postgres).
 *
 * defineTable reconciliation preserves accepted state; incompatible active configuration changes are refused.
 * Hosts drive `tick()`.
 */

import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { isNamespacedKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { MatchmakingSchemaDriftError } from '@pkgs/matchmaking-root-shared-ts/errors';
import type { MatchmakingSchema } from '@pkgs/matchmaking-root-shared-ts/schema';
import {
  installPostgresSqliteCompat,
  isPostgresSqlClient,
} from '@pkgs/postgres-sqlite-compat-shared-ts/install';
import { getUnderlyingSqlClient } from '@pkgs/sql-client-root-shared-ts/impl-agnostic';
import type {
  PostgresSqlClient,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { MATCHMAKING_SCHEMA_STATE_ID, matchmakingSchema } from './tables';

export type MigrateOptions = {
  readonly sqlClient: SqlClient;
  readonly schema?: MatchmakingSchema;
  /** Wall clock for managed timestamps (fingerprint upsert). */
  readonly now: () => number;
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
    await reconcilePostgresSchema(
      engine,
      matchmakingSchema,
      (engine as PostgresSqlClient).dbScope,
      {
        skipAdvisoryLock: true,
        alreadyInTransaction: false,
      }
    );
    return;
  }
  await reconcileSqliteSchema(engine, matchmakingSchema, {
    ownership: 'declared-only',
  });
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

async function recordSchemaFingerprint(
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
  if (currentFp !== null) {
    const active = await sqlClient.query(sql<{ id: string }>`
      SELECT id FROM matchmaking_waiting WHERE deleted_at IS NULL LIMIT 1`);
    if (active.length > 0) throw new MatchmakingSchemaDriftError(fp, currentFp);
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
  const next = migrateChain.then(run, run);
  migrateChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function migrateInner(opts: MigrateOptions): Promise<void> {
  const schema = resolveSchema(opts.schema);
  const { sqlClient } = opts;
  const nowMs = opts.now();
  const engine = getUnderlyingSqlClient(sqlClient);
  await installPostgresSqliteCompat({ sqlClient: engine });
  await applyMatchmakingSchema(engine);
  await recordSchemaFingerprint(sqlClient, schema, nowMs);
}
