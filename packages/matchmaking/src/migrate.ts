/**
 * Owns the `matchmaking_queue` table and the PL/pgSQL functions that drive
 * matching end to end. Idempotent: safe to call on every boot.
 *
 * Schema invariants:
 *   - No domain-specific columns. Everything caller-shaped lives in JSONB:
 *     `data` (the participant's attributes, branded `AttributeState` in JS)
 *     and `formulas` (the participant's ordered list of acceptance
 *     criteria, each a `DistanceFormula`).
 *   - Matching is per-row: each waiting row carries its own `formulas`.
 *     Two participants match iff there exists a pair `(fa, fb)` from their
 *     formula lists such that both formulas accept the pair (partition
 *     compatibility and distance within each side's radius). Matching is
 *     asymmetric — A may use a strict rating-only formula while B insists
 *     on a partition.
 *   - When a pair matches, the function mints a fresh `match_id` UUID and
 *     writes it on both rows. Callers poll `status(participantId)` and use
 *     the emitted `matchId` as a downstream handle (e.g. a Durable Object
 *     name) to bring the match online.
 *
 * Scale layer (declared by the caller via {@link MatchmakingSchema}):
 *   - `partition_signature` (stored generated): concatenation of declared
 *     partition keys. Rows in different signatures are never candidates
 *     for each other. Empty `partitionKeys` collapses everyone into one
 *     shard with signature `''`. The signature is ALSO the natural shard
 *     key for the per-pass throttle (see below).
 *   - `primary_rating` / `primary_bucket` (stored generated): the numeric
 *     rating axis used to pre-filter candidates. With a primary key
 *     declared, the pass function only considers candidates within
 *     `ceil(radius / bucketWidth)` buckets of the seeker — turns the
 *     match pass from O(N²) into O(N * ringSize).
 *   - Partial index on `(partition_signature, primary_bucket, joined_at)
 *     WHERE status='waiting'`: matched rows aren't in the index, so the
 *     snapshot scan walks only the live queue. Combined with `fillfactor=80`
 *     the status='matched' UPDATE never has to touch an index → HOT.
 *   - `matchmaking_pass_runs`: per-`(partition_signature, kind)` throttle
 *     table. Different partitions run passes in PARALLEL through Postgres;
 *     only same-partition passes serialise. This is the chess.com-scale
 *     change — one Postgres primary now hosts N independent matchmakers.
 */

import { assert } from '@gamezilla/lib/assert';
import { isNamespacedKeyword } from '@gamezilla/lib/keyword';
import type { Pool } from 'pg';
import {
  ALTER_ADD_LEGACY_COLUMNS_SQL,
  CREATE_MATCHED_INDEX_SQL,
  CREATE_MATCH_ID_INDEX_SQL,
  CREATE_PAIR_COMPATIBLE_SQL,
  CREATE_PAIR_DISTANCE_SQL,
  CREATE_PAIR_MATCH_SQL,
  CREATE_PASS_RUNS_TABLE_SQL,
  CREATE_RUN_MATCH_PASS_SQL,
  CREATE_SCHEMA_STATE_TABLE_SQL,
  CREATE_SWEEP_EXPIRED_SQL,
  CREATE_SWEEP_MATCHED_SQL,
  CREATE_TABLE_SQL,
  CREATE_WAITING_INDEX_SQL,
  DROP_GENERATED_COLUMNS_SQL,
  DROP_LEGACY_COLUMN_SQL,
  DROP_LEGACY_INDEX_SQL,
  DROP_MATCHED_INDEX_SQL,
  DROP_OLD_BUCKET_INDEX_SQL,
  DROP_OLD_JOINED_AT_INDEX_SQL,
  DROP_RUN_MATCH_PASS_LEGACY_SIGNATURES,
  DROP_SWEEP_EXPIRED_LEGACY_SIGNATURES,
  DROP_SWEEP_MATCHED_LEGACY_SIGNATURES,
  DROP_WAITING_INDEX_SQL,
  SET_FILLFACTOR_SQL,
} from './migrate-sql';
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';

export type MatchmakingSchema = {
  /**
   * Hard-partitioning keys (e.g. region, mode, time-control). Two
   * participants are never candidates unless they agree on every declared
   * key. Empty array → one global shard. Acts as the throttle shard key.
   */
  readonly partitionKeys?: readonly string[];
  /**
   * The single numeric attribute used to bucket candidates for fast ring
   * queries. When undefined, every row falls into bucket 0 and the
   * bucket index degrades into a per-partition list — still safe, just
   * loses the rating-axis speedup.
   */
  readonly primaryNumericKey?: string;
  /**
   * Bucket width on the primary numeric axis. Defaults to 50. A seeker
   * with radius R considers candidates in `ceil(R / bucketWidth)` buckets
   * either side.
   */
  readonly bucketWidth?: number;
};

export type MigrateArgs = (
  | { readonly pool: Pool; readonly sqlClient?: never }
  | { readonly sqlClient: SqlClient; readonly pool?: never }
) & {
  readonly schema?: MatchmakingSchema;
};

const DEFAULT_BUCKET_WIDTH = 50;

// Bumped any time the schema shape changes (column definitions, index
// definitions, throttle-table PK shape, etc.) so existing deployments
// detect the mismatch via `matchmaking_schema_state` and rebuild.
const SCHEMA_VERSION = 2;

type ResolvedSchema = {
  readonly partitionKeys: readonly string[];
  readonly primaryNumericKey: string | undefined;
  readonly bucketWidth: number;
};

function resolveSchema(schema: MatchmakingSchema | undefined): ResolvedSchema {
  const partitionKeys = schema?.partitionKeys ?? [];
  const primaryNumericKey = schema?.primaryNumericKey;
  const bucketWidth = schema?.bucketWidth ?? DEFAULT_BUCKET_WIDTH;
  for (const k of partitionKeys) {
    assert.ok(
      isNamespacedKeyword(k),
      'matchmaking schema partition key must be a namespaced keyword',
      { key: k }
    );
  }
  if (primaryNumericKey !== undefined) {
    assert.ok(
      isNamespacedKeyword(primaryNumericKey),
      'matchmaking schema primaryNumericKey must be a namespaced keyword',
      { key: primaryNumericKey }
    );
  }
  assert.ok(
    Number.isFinite(bucketWidth) && bucketWidth > 0,
    'matchmaking schema bucketWidth must be a positive finite number',
    { bucketWidth }
  );
  return { partitionKeys, primaryNumericKey, bucketWidth };
}

// Keyword validation already rules out single quotes, but escape anyway —
// generated column expressions are caller-influenced and worth defending.
function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function fingerprintSchema(schema: ResolvedSchema): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    partitionKeys: schema.partitionKeys,
    primaryNumericKey: schema.primaryNumericKey ?? null,
    bucketWidth: schema.bucketWidth,
  });
}

/**
 * Stable fingerprint of a caller-declared {@link MatchmakingSchema}.
 * Exposed so the `Matchmaker` can lazily assert the schema it was
 * configured with matches the schema the migration actually installed —
 * a mismatch silently produces wrong `partition_signature` values and
 * causes zero matches with no other warning.
 */
export function fingerprintForOptions(
  schema: MatchmakingSchema | undefined
): string {
  return fingerprintSchema(resolveSchema(schema));
}

function partitionSignatureExpr(partitionKeys: readonly string[]): string {
  if (partitionKeys.length === 0) return `''::TEXT`;
  const unit = String.fromCharCode(0x1f);
  const sep = sqlString(unit);
  const parts = partitionKeys.map(
    (k) => `COALESCE(data->>${sqlString(k)}, '')`
  );
  return parts.join(` || ${sep} || `);
}

function primaryRatingExpr(primaryNumericKey: string | undefined): string {
  if (primaryNumericKey === undefined) return `0::NUMERIC`;
  return `COALESCE((data->>${sqlString(primaryNumericKey)})::NUMERIC, 0)`;
}

// Postgres forbids generated columns from referencing other generated
// columns, so primary_bucket inlines the rating expression instead of
// reusing `primary_rating`. The two columns stay in lockstep because
// they're both derived from the same `data->>primaryNumericKey`.
function primaryBucketExpr(
  primaryNumericKey: string | undefined,
  bucketWidth: number
): string {
  return `FLOOR(${primaryRatingExpr(primaryNumericKey)} / ${String(bucketWidth)}::NUMERIC)::INT`;
}

function buildGeneratedColumnsSql(schema: ResolvedSchema): string {
  const partExpr = partitionSignatureExpr(schema.partitionKeys);
  const ratingExpr = primaryRatingExpr(schema.primaryNumericKey);
  const bucketExpr = primaryBucketExpr(
    schema.primaryNumericKey,
    schema.bucketWidth
  );
  return `
ALTER TABLE matchmaking_queue
  ADD COLUMN partition_signature TEXT    GENERATED ALWAYS AS (${partExpr})  STORED,
  ADD COLUMN primary_rating      NUMERIC GENERATED ALWAYS AS (${ratingExpr}) STORED,
  ADD COLUMN primary_bucket      INT     GENERATED ALWAYS AS (${bucketExpr}) STORED
`.trim();
}

function resolveSqlClient(args: MigrateArgs): SqlClient {
  if (args.sqlClient !== undefined) return args.sqlClient;
  return createPgSqlClient(args.pool);
}

// Detects whether `matchmaking_pass_runs` already exists in its current
// (partition_signature, kind) shape. Returns false when the legacy
// (id INT PRIMARY KEY) table is present so the caller can drop it before
// recreating with the new PK.
async function passRunsTableHasNewShape(
  sqlClient: SqlClient
): Promise<boolean> {
  const result = await sqlClient.query<{ has_col: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'matchmaking_pass_runs'
         AND column_name = 'partition_signature'
     ) AS has_col`
  );
  return result.rows[0]?.has_col === true;
}

async function ensurePassRunsTable(sqlClient: SqlClient): Promise<void> {
  if (!(await passRunsTableHasNewShape(sqlClient))) {
    await sqlClient.query('DROP TABLE IF EXISTS matchmaking_pass_runs');
  }
  await sqlClient.query(CREATE_PASS_RUNS_TABLE_SQL);
}

async function maybeRebuildSchema(
  sqlClient: SqlClient,
  schema: ResolvedSchema
): Promise<void> {
  const fp = fingerprintSchema(schema);
  const state = await sqlClient.query<{ schema_fingerprint: string }>(
    `SELECT schema_fingerprint FROM matchmaking_schema_state WHERE id = 1`
  );
  const currentFp = state.rows[0]?.schema_fingerprint ?? null;
  if (currentFp === fp) return;

  // Order matters: indexes depend on columns, so drop both then recreate
  // bottom-up. `IF EXISTS` lets the first-ever migrate run pass through.
  await sqlClient.query(DROP_OLD_BUCKET_INDEX_SQL);
  await sqlClient.query(DROP_WAITING_INDEX_SQL);
  await sqlClient.query(DROP_MATCHED_INDEX_SQL);
  await sqlClient.query(DROP_GENERATED_COLUMNS_SQL);
  await sqlClient.query(buildGeneratedColumnsSql(schema));
  await sqlClient.query(SET_FILLFACTOR_SQL);
  await sqlClient.query(CREATE_WAITING_INDEX_SQL);
  await sqlClient.query(CREATE_MATCHED_INDEX_SQL);
  await sqlClient.query(
    `INSERT INTO matchmaking_schema_state (id, schema_fingerprint)
     VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET schema_fingerprint = EXCLUDED.schema_fingerprint`,
    [fp]
  );
}

export async function migrate(args: MigrateArgs): Promise<void> {
  const sqlClient = resolveSqlClient(args);
  const schema = resolveSchema(args.schema);

  const upfront = [
    DROP_LEGACY_COLUMN_SQL,
    DROP_LEGACY_INDEX_SQL,
    DROP_OLD_JOINED_AT_INDEX_SQL,
    CREATE_TABLE_SQL,
    ALTER_ADD_LEGACY_COLUMNS_SQL,
    CREATE_MATCH_ID_INDEX_SQL,
    CREATE_SCHEMA_STATE_TABLE_SQL,
  ];
  for (const sql of upfront) {
    await sqlClient.query(sql);
  }

  await ensurePassRunsTable(sqlClient);
  await maybeRebuildSchema(sqlClient, schema);

  const functions = [
    CREATE_PAIR_DISTANCE_SQL,
    CREATE_PAIR_COMPATIBLE_SQL,
    CREATE_PAIR_MATCH_SQL,
    ...DROP_RUN_MATCH_PASS_LEGACY_SIGNATURES,
    ...DROP_SWEEP_EXPIRED_LEGACY_SIGNATURES,
    ...DROP_SWEEP_MATCHED_LEGACY_SIGNATURES,
    CREATE_RUN_MATCH_PASS_SQL,
    CREATE_SWEEP_EXPIRED_SQL,
    CREATE_SWEEP_MATCHED_SQL,
  ];
  for (const sql of functions) {
    await sqlClient.query(sql);
  }
}
