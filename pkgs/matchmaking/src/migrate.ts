/**
 * Owns the chess.com-scale matchmaking schema:
 *
 *   - `matchmaking_waiting`  UNLOGGED, PARTITION BY HASH(partition_signature)
 *     across {@link NUM_WAITING_PARTITIONS} (16) child partitions. This
 *     is THE hot table; every join inserts here, every pass reads + deletes
 *     here. UNLOGGED skips WAL — waiting rows are recoverable (clients
 *     rejoin) so durability is not required. Hash partitioning lets
 *     autovacuum run independently per partition, divides index size by
 *     16, and spreads write lock pages across 16 page chains.
 *   - `matchmaking_matched`  LOGGED single table holding the small,
 *     short-lived tail of paired rows that `/status` polls can still
 *     read. Indexed by `match_id` (peer fetch) and `matched_at` (sweep).
 *   - `matchmaking_active_partitions`  UNLOGGED helper. Every `/join`
 *     UPSERTs its `partition_signature`; the tick fan-out reads this
 *     tiny table instead of `SELECT DISTINCT partition_signature ...`
 *     over the hot waiting table.
 *   - `matchmaking_schema_state`  fingerprint state for idempotent
 *     rebuilds across schema bumps.
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
 *     asymmetric.
 *   - When a pair matches, the function mints a fresh `match_id` UUID,
 *     DELETEs both waiting rows, and INSERTs them into
 *     `matchmaking_matched` carrying the new `match_id`. Callers poll
 *     `status(participantId)` and use the emitted `matchId` as a
 *     downstream handle (e.g. a Durable Object name).
 *
 * Scale layer (declared by the caller via {@link MatchmakingSchema}):
 *   - `partition_signature` (stored generated): concatenation of declared
 *     partition keys. Rows in different signatures are never candidates
 *     for each other. Empty `partitionKeys` collapses everyone into one
 *     shard with signature `''`. The signature is ALSO the hash key for
 *     `matchmaking_waiting` partitioning.
 *   - `primary_rating` / `primary_bucket` (stored generated): the numeric
 *     rating axis used to pre-filter candidates. With a primary key
 *     declared, the pass function only considers candidates within
 *     `ceil(radius / bucketWidth)` buckets of the seeker.
 *   - Index on `(partition_signature, primary_bucket, joined_at)` on the
 *     parent — propagates to every hash child. Snapshot scan is in-order
 *     so no sort step.
 */

import { assert } from '@pkgs/assert';
import { isNamespacedKeyword } from '@pkgs/keyword';
import type { Pool } from 'pg';
import {
  ADD_METADATA_COLUMN_TO_MATCHED_SQL,
  CREATE_ACTIVE_PARTITIONS_TABLE_SQL,
  CREATE_MATCHED_MATCH_ID_INDEX_SQL,
  CREATE_MATCHED_MATCHED_AT_INDEX_SQL,
  CREATE_MATCHED_TABLE_SQL,
  CREATE_PAIR_COMPATIBLE_SQL,
  CREATE_PAIR_DISTANCE_SQL,
  CREATE_PAIR_MATCH_SQL,
  CREATE_RUN_MATCH_PASS_SQL,
  CREATE_SCHEMA_STATE_TABLE_SQL,
  CREATE_SWEEP_EXPIRED_SQL,
  CREATE_SWEEP_MATCHED_SQL,
  CREATE_WAITING_INDEX_SQL,
  DROP_ACTIVE_PARTITIONS_SQL,
  DROP_TICK_FUNCTION_SQL,
  DROP_WAITING_TABLE_SQL,
  NUM_WAITING_PARTITIONS,
  buildCreateTickFunctionSql,
  buildCreateWaitingChildSql,
  buildCreateWaitingTableSql,
} from './migrate-sql';
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';
import { DEFAULT_RADIUS_OPTIONS, type RadiusOptions } from './types';

export type MatchmakingSchema = {
  /**
   * Hard-partitioning keys (e.g. region, mode, time-control). Two
   * participants are never candidates unless they agree on every declared
   * key. Empty array → one global shard. Also acts as the hash key for
   * the `matchmaking_waiting` table partitioning.
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

/**
 * Tunings that `migrate()` bakes into the `matchmaking_tick()` PL/pgSQL
 * function. These are the SAME tunings the `Matchmaking` constructor
 * accepts via `MatchmakingTuning`; the constructor forwards them here
 * so the cron-driven tick uses the deployment's configured values.
 *
 * No `now` clock hook — the tick function calls `now()` server-side. JS
 * tests that want a simulated clock keep driving via `mm.tick()` (which
 * does pass `nowParam`).
 */
export type MigrateTuning = {
  readonly maxPairsPerPass?: number;
  readonly maxWaitSeconds?: number;
  readonly matchedRetentionSeconds?: number;
};

export type MigrateArgs = (
  | { readonly pool: Pool; readonly sqlClient?: never }
  | { readonly sqlClient: SqlClient; readonly pool?: never }
) & {
  readonly schema?: MatchmakingSchema;
  /** Forwarded into the baked `matchmaking_tick()` function body. */
  readonly radius?: RadiusOptions;
  /** Forwarded into the baked `matchmaking_tick()` function body. */
  readonly tuning?: MigrateTuning;
};

const DEFAULT_BUCKET_WIDTH = 50;
const DEFAULT_MAX_PAIRS_PER_PASS = 500;
const DEFAULT_MAX_WAIT_SECONDS = 300;
const DEFAULT_MATCHED_RETENTION_SECONDS = 3600;
const DEFAULT_MAX_PARTITIONS_FANOUT = 1024;
const DEFAULT_MAX_PASSES_PER_PARTITION = 8;
/**
 * `matchmaking_active_partitions` watermark prune: any signature
 * older than this with zero waiters gets DELETEd on every cron tick.
 * 24h is well past any realistic queue session; covers the case
 * where a one-off partition (e.g. a temporary region) was used once
 * and never again. Without this the side table grows monotonically
 * with the cardinality of the partition-key space.
 */
const DEFAULT_ACTIVE_PARTITIONS_PRUNE_AGE = 24 * 60 * 60;
/**
 * Hard cap on the side table. After the watermark prune, if the table
 * still exceeds this count, drop the oldest `first_seen_at` rows down
 * to the cap. Defence against a runaway partition cardinality bug
 * (e.g. someone misconfigures `partitionKeys` to include a unique id).
 */
const DEFAULT_ACTIVE_PARTITIONS_HARD_CAP = 50_000;
const CRON_SCHEDULE = '5 seconds';
const CRON_JOB_NAME = 'matchmaking-tick';

// Bumped any time the schema shape changes (column definitions, index
// definitions, partition layout, etc.) so existing deployments detect
// the mismatch via `matchmaking_schema_state` and rebuild.
//   v3: split tables, hash-partitioned waiting, no throttle plumbing.
//   v4: adds `group_size` column on waiting + extends active_partitions
//       PK to (signature, group_size) for N-way group matching.
//   v5: adds `priority` + `metadata` columns on waiting, extends the
//       hot index to (sig, group_size, primary_bucket, priority DESC,
//       joined_at). Adds `metadata` column on matched. Per-formula
//       radius is honoured by matchmaking_pair_match.
const SCHEMA_VERSION = 5;

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

function resolveSqlClient(args: MigrateArgs): SqlClient {
  if (args.sqlClient !== undefined) return args.sqlClient;
  return createPgSqlClient(args.pool);
}

/**
 * Rebuilds the waiting table (parent + every hash child + index) when
 * the schema fingerprint changes. Safe to call repeatedly; the
 * fingerprint guard upstream skips this when no rebuild is needed.
 */
async function rebuildWaitingTable(
  sqlClient: SqlClient,
  schema: ResolvedSchema
): Promise<void> {
  // Drop both waiting and active_partitions ahead of the rebuild.
  // `matchmaking_active_partitions` PK shape changed in v4 (added
  // `group_size`); on a v3->v4 migration this DROP makes sure the
  // CREATE below picks up the new PK rather than colliding with the
  // old single-column PK. Active partitions get re-derived on the
  // next join.
  await sqlClient.query(DROP_WAITING_TABLE_SQL);
  await sqlClient.query(DROP_ACTIVE_PARTITIONS_SQL);
  await sqlClient.query(CREATE_ACTIVE_PARTITIONS_TABLE_SQL);
  await sqlClient.query(
    buildCreateWaitingTableSql({
      primaryRatingExpr: primaryRatingExpr(schema.primaryNumericKey),
      primaryBucketExpr: primaryBucketExpr(
        schema.primaryNumericKey,
        schema.bucketWidth
      ),
    })
  );
  for (let i = 0; i < NUM_WAITING_PARTITIONS; i += 1) {
    await sqlClient.query(buildCreateWaitingChildSql(i));
  }
  await sqlClient.query(CREATE_WAITING_INDEX_SQL);
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

  await rebuildWaitingTable(sqlClient, schema);
  await sqlClient.query(
    `INSERT INTO matchmaking_schema_state (id, schema_fingerprint)
     VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET schema_fingerprint = EXCLUDED.schema_fingerprint`,
    [fp]
  );
}

/**
 * Detects whether the pg_cron extension is installed in this database.
 * PGlite (tests) and any deploy that hasn't run `CREATE EXTENSION
 * pg_cron` returns false, in which case migrate skips the
 * `cron.schedule` call entirely. The PL/pgSQL `matchmaking_tick()`
 * function is still installed (it's just unscheduled) so the JS
 * `mm.tick()` entry point and tests keep working unchanged.
 */
async function isPgCronInstalled(sqlClient: SqlClient): Promise<boolean> {
  try {
    const result = await sqlClient.query<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
       ) AS ok`
    );
    return result.rows[0]?.ok === true;
  } catch {
    // `pg_extension` is a system view present on all real Postgres
    // installs. PGlite throws here; treat any error as "no pg_cron".
    return false;
  }
}

/**
 * Heuristic for "pg_cron rejected the schedule because a job of this
 * name already exists" — the exact wording differs across pg_cron
 * versions but they all contain either the name or the words "exists"
 * / "duplicate". Stay loose to avoid false negatives across upgrades.
 */
function isCronDuplicateNameError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes(CRON_JOB_NAME.toLowerCase()) ||
    m.includes('duplicate') ||
    m.includes('already exists') ||
    m.includes('unique constraint')
  );
}

async function scheduleMatchmakingTick(sqlClient: SqlClient): Promise<void> {
  // pg_cron 1.5+ replaces the existing schedule when called with the
  // same job name. Earlier versions error on the second `cron.schedule`
  // — when that happens, fall back to `cron.unschedule(name)` then
  // re-schedule. The unschedule fallback is itself best-effort; if the
  // platform doesn't expose unschedule we surface the original error.
  try {
    await sqlClient.query(`SELECT cron.schedule($1, $2, $3) AS jobid`, [
      CRON_JOB_NAME,
      CRON_SCHEDULE,
      `SELECT matchmaking_tick()`,
    ]);
    return;
  } catch (err) {
    if (!isCronDuplicateNameError(err)) throw err;
  }
  await sqlClient.query(`SELECT cron.unschedule($1)`, [CRON_JOB_NAME]);
  await sqlClient.query(`SELECT cron.schedule($1, $2, $3) AS jobid`, [
    CRON_JOB_NAME,
    CRON_SCHEDULE,
    `SELECT matchmaking_tick()`,
  ]);
}

export async function migrate(args: MigrateArgs): Promise<void> {
  const sqlClient = resolveSqlClient(args);
  const schema = resolveSchema(args.schema);
  const radius = args.radius ?? DEFAULT_RADIUS_OPTIONS;
  const tuning = args.tuning ?? {};

  // Upfront: create the always-on tables (matched, active_partitions,
  // schema_state). Idempotent.
  //
  // `ADD_METADATA_COLUMN_TO_MATCHED_SQL` is the v4→v5 in-place upgrade
  // for `matchmaking_matched.metadata`. We can't just rebuild matched
  // (it's LOGGED and holds live, durable match state); ALTER TABLE …
  // ADD COLUMN IF NOT EXISTS is the safe upgrade path.
  const upfront = [
    CREATE_SCHEMA_STATE_TABLE_SQL,
    CREATE_MATCHED_TABLE_SQL,
    ADD_METADATA_COLUMN_TO_MATCHED_SQL,
    CREATE_MATCHED_MATCH_ID_INDEX_SQL,
    CREATE_MATCHED_MATCHED_AT_INDEX_SQL,
    CREATE_ACTIVE_PARTITIONS_TABLE_SQL,
  ];
  for (const sql of upfront) {
    await sqlClient.query(sql);
  }

  await maybeRebuildSchema(sqlClient, schema);

  // Function-creation block runs inside a single transaction so a
  // failure halfway through (e.g. a syntax error in a tuning-baked
  // body, a permission error on one CREATE) leaves the previous
  // generation of functions intact rather than installing a partial
  // mix. `CREATE FUNCTION` is fully transactional in Postgres; the
  // waiting-table rebuild above stays OUTSIDE this tx because
  // DROP/CREATE TABLE on a partitioned parent has its own MVCC
  // requirements that don't compose cleanly with subsequent CREATE
  // FUNCTION ... that references the new table within the same tx.
  const functions = [
    CREATE_PAIR_DISTANCE_SQL,
    CREATE_PAIR_COMPATIBLE_SQL,
    CREATE_PAIR_MATCH_SQL,
    CREATE_RUN_MATCH_PASS_SQL,
    CREATE_SWEEP_EXPIRED_SQL,
    CREATE_SWEEP_MATCHED_SQL,
    DROP_TICK_FUNCTION_SQL,
    buildCreateTickFunctionSql({
      baseRadius: radius.baseRadius,
      radiusGrowthPerSecond: radius.radiusGrowthPerSecond,
      maxRadius: radius.maxRadius,
      bucketWidth: schema.bucketWidth,
      maxPairsPerPass: tuning.maxPairsPerPass ?? DEFAULT_MAX_PAIRS_PER_PASS,
      maxWaitSeconds: tuning.maxWaitSeconds ?? DEFAULT_MAX_WAIT_SECONDS,
      matchedRetentionSeconds:
        tuning.matchedRetentionSeconds ?? DEFAULT_MATCHED_RETENTION_SECONDS,
      maxPartitionsFanout: DEFAULT_MAX_PARTITIONS_FANOUT,
      maxPassesPerPartition: DEFAULT_MAX_PASSES_PER_PARTITION,
      activePartitionsHardCap: DEFAULT_ACTIVE_PARTITIONS_HARD_CAP,
      activePartitionsPruneAgeSeconds: DEFAULT_ACTIVE_PARTITIONS_PRUNE_AGE,
    }),
  ];
  await sqlClient.tx(async (tx) => {
    for (const sql of functions) {
      await tx.query(sql);
    }
  });

  if (await isPgCronInstalled(sqlClient)) {
    await scheduleMatchmakingTick(sqlClient);
  }
}
