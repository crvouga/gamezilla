/**
 * Thin wrapper around the chess.com-scale matchmaking schema (v3).
 *
 * Every queue mutation is a single SQL statement (sometimes a CTE that
 * touches two tables atomically). `runMatchPass` calls the server-side
 * `matchmaking_run_match_pass()` function which does the row locking,
 * formula-driven distance computation, pairing, atomic
 * DELETE-from-waiting + INSERT-into-matched, and match-id minting
 * inside one PL/pgSQL routine. The only state held in JS is the
 * radius / tuning config the constructor receives — no in-memory queue
 * mirror, no in-flight match buffer, no pairing algorithm.
 *
 * Per-participant formulas: each `join()` carries a non-empty ORDERED list
 * of `DistanceFormula`s the participant is willing to accept; the SQL
 * function picks the first mutually-satisfied pair. There is no global
 * formula and no completion callback — callers poll `status(participantId)`
 * and read the emitted `matchId` to bring the match online (e.g. as a
 * Durable Object).
 *
 * Two-table topology (chess.com-scale):
 *   - `matchmaking_waiting`: UNLOGGED, hash-partitioned by
 *     `partition_signature` across 16 children. `join()` writes here;
 *     `runMatchPass` reads + deletes here. UNLOGGED skips WAL, hash
 *     partitioning divides autovacuum + index size + lock pages by 16.
 *   - `matchmaking_matched`: LOGGED single table holding the short-
 *     lived tail of paired rows. `runMatchPass` inserts here when a
 *     pair is made; `status()` reads here when looking up a matched
 *     participant; `sweepMatched()` reaps rows older than the configured
 *     retention.
 *   - `matchmaking_active_partitions`: side table of distinct
 *     `partition_signature` values currently observed. `join()` UPSERTs;
 *     `discoverActivePartitions` reads a tiny index scan instead of
 *     `SELECT DISTINCT` over the hot waiting table.
 *
 * Partition-scoped passes: `runMatchPass(sig)` / `sweepExpired(sig)`
 * operate on ONE partition. Different partitions run in parallel
 * through Postgres because Postgres-side hash partitioning gives each
 * one its own page chain + row locks.
 *
 * Tiger-style asserts run at every boundary:
 *   - `join()` validates `data` is an `AttributeState`, `formulas` is
 *     a non-empty array bounded by {@link MAX_FORMULAS_PER_PARTICIPANT},
 *     and every formula's numeric tags resolve to a finite number from
 *     `data`.
 *   - `status()` re-brands the JSONB rows coming back from the DB as
 *     `AttributeState` via `asKeywordRecord`.
 *
 * The library is use-case agnostic — it doesn't assume matches are
 * competitive, cooperative, conversational, or anything else. The caller
 * decides the meaning through `data` and `formulas`.
 *
 * INTERNAL MODULE: every class, method, type, and constant in this file
 * is internal to `@gamezilla/matchmaking` and not part of the public
 * API. The package's `exports` map and the root `tsconfig.json` paths
 * deliberately make this file unreachable from outside the package; do
 * not change either map without considering the abstraction contract.
 * Consumers go through `Matchmaking` (the public facade in
 * `matchmaking.ts`).
 *
 * @internal
 */

import { assert } from '@gamezilla/lib/assert';
import type { AttributeState } from '@gamezilla/lib/attribute';
import { asKeywordRecord, assertKeywordRecord } from '@gamezilla/lib/keyword';
import type { Pool } from 'pg';
import {
  assertDataMatchesFormula,
  assertFormula,
  assertWireFormula,
  type FormulaWire,
  serializeFormula,
} from './formula-wire';
import { fingerprintForOptions, type MatchmakingSchema } from './migrate';
import {
  MATCHMAKING_MAX_GROUP_SIZE,
  MATCHMAKING_MAX_PRIORITY,
  MATCHMAKING_MIN_GROUP_SIZE,
  MATCHMAKING_MIN_PRIORITY,
} from './migrate-sql';
import { MATCHMAKING_PAYLOAD_LIMITS } from './payload-limits';
import { parallelMap } from './parallel-map';
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';
import {
  DEFAULT_RADIUS_OPTIONS,
  type DistanceFormula,
  type JoinInput,
  type JoinResult,
  type LeaveResult,
  type _MatchPassResult,
  type MatchedParticipant,
  type ParticipantStatus,
  type RadiusOptions,
  type StatusResult,
  type UpdateFormulasResult,
} from './types';

export type {
  CategoricalTermWire,
  FormulaWire,
  NumericTermWire,
  PartitionTermWire,
} from './formula-wire';

/**
 * Hard cap on the per-participant formulas array. Each formula multiplies
 * the work of `matchmaking_pair_match` by a constant; an unbounded array
 * lets a single malicious join blow up every subsequent pass. 8 is well
 * over realistic use cases (OR over a handful of preset queue modes).
 */
export const MAX_FORMULAS_PER_PARTICIPANT = 8;

// Bigger than v2 because the ticker DO is the sole caller — we want to
// amortise the round-trip across as much pairing work as possible.
const DEFAULT_MAX_PAIRS_PER_PASS = 500;
const DEFAULT_BUCKET_WIDTH = 50;
const DEFAULT_MAX_PASSES_DRAIN = 8;
const DEFAULT_MAX_PARTITIONS_FANOUT = 1024;
const DEFAULT_MATCHED_RETENTION_SECONDS = 3600;
const DEFAULT_DRAIN_CONCURRENCY = 8;

// The SQL-side partition_signature uses 0x1F (ASCII unit separator) as
// the join character. JS-computed signatures must match byte-for-byte or
// the DB will refuse to surface candidates. Keep this in lockstep with
// `partitionSignatureExpr` in migrate.ts.
const PARTITION_SIGNATURE_SEPARATOR = String.fromCharCode(0x1f);

export type MatchmakerOptions = {
  readonly pool?: Pool;
  readonly sqlClient?: SqlClient;
  readonly radius?: RadiusOptions;
  /**
   * Optional clock override (epoch ms). When omitted, the SQL function uses
   * the database's `now()` — recommended in production so wait times stay
   * consistent with `joined_at`. Tests inject this to simulate time
   * advancing without sleeping.
   */
  readonly now?: () => number;
  /**
   * Maximum pairs emitted per `runMatchPass()` call. Default
   * {@link DEFAULT_MAX_PAIRS_PER_PASS} (500). Cron/ticker-driven
   * deployments benefit from large passes (fewer round-trips); test
   * fixtures often want a smaller number for predictable assertions.
   */
  readonly maxPairsPerPass?: number;
  /**
   * When set, `sweepExpired()` deletes waiting rows older than this.
   * Default `undefined` (sweep is a no-op).
   */
  readonly maxWaitSeconds?: number;
  /**
   * Hard partition keys, must match what was declared on `migrate()`.
   * Default empty (one global shard). `partitionSignatureFor` and the
   * lazy schema-fingerprint assert both depend on this matching the DB.
   */
  readonly partitionKeys?: readonly string[];
  /**
   * Bucket width on the primary numeric axis. Should match the value
   * passed to {@link migrate}. A mismatch is safe but degrades the
   * bucket pre-filter to a wider scan. Default
   * {@link DEFAULT_BUCKET_WIDTH}.
   */
  readonly bucketWidth?: number;
  /**
   * When set, `sweepMatched()` deletes matched rows older than this.
   * Default {@link DEFAULT_MATCHED_RETENTION_SECONDS}. Set to `0` to
   * disable matched-row cleanup (the table will grow unbounded).
   */
  readonly matchedRetentionSeconds?: number;
  /**
   * Caller-declared schema, used for the lazy schema-drift assertion
   * the first time `join()` runs. When omitted the drift check is
   * skipped (used by tests that construct a Matchmaker directly). The
   * public `Matchmaking` facade always supplies this.
   */
  readonly schema?: MatchmakingSchema;
  /**
   * Callback invoked when the lazy schema-drift probe detects that
   * the in-process schema fingerprint differs from what `migrate()`
   * actually installed. Must `throw` — typed as `never` for the
   * caller's convenience. The public facade wires this to the typed
   * `MatchmakingSchemaDriftError`.
   */
  readonly onSchemaDrift?: (expected: string, actual: string) => never;
};

type StatusRow = {
  readonly status: ParticipantStatus;
  readonly data: Record<string, unknown>;
  readonly metadata: Record<string, unknown> | null;
  readonly match_id: string | null;
};

type ParticipantRow = {
  readonly id: string;
  readonly joined_at: Date;
  readonly data: Record<string, unknown>;
  readonly metadata: Record<string, unknown> | null;
};

type MatchPassRow = {
  readonly match_id: string;
  readonly participant_id: string;
  readonly joined_at: Date;
  readonly data: Record<string, unknown>;
};

export type JoinInputRaw = {
  readonly data: AttributeState;
  readonly formulas: readonly FormulaWire[];
  readonly groupSize?: number;
  readonly priority?: number;
  readonly metadata?: Record<string, unknown> | null;
};

export type UpdateFormulasInputRaw = {
  readonly formulas: readonly FormulaWire[];
};

export type RunMatchPassesOptions = {
  readonly maxPasses?: number;
  readonly groupSize?: number;
  readonly signal?: AbortSignal;
};

/**
 * A (signature, group_size) pair pulled from
 * `matchmaking_active_partitions`. The drain fans out one task per
 * pair because different group sizes never cross-match (the
 * SQL `matchmaking_run_match_pass` filters on `group_size` as part
 * of its candidate snapshot).
 *
 * @internal
 */
export type ActivePartition = {
  readonly partitionSignature: string;
  readonly groupSize: number;
};

export type RunMatchPassesResult = {
  readonly matches: number;
  readonly passes: number;
};

export type SweepExpiredResult = {
  readonly removed: number;
};

export type SweepMatchedResult = {
  readonly removed: number;
};

export type RunMatchPassesAcrossPartitionsOptions = {
  readonly maxPartitions?: number;
  readonly maxPassesPerPartition?: number;
  /** Bounded JS-side concurrency for partition drains. Default 8. */
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
};

export type RunMatchPassesAcrossPartitionsResult = {
  readonly matches: number;
  readonly passes: number;
  readonly partitions: number;
};

export type SweepExpiredAcrossPartitionsOptions = {
  readonly maxPartitions?: number;
  /** Bounded JS-side concurrency for partition sweeps. Default 8. */
  readonly concurrency?: number;
};

export type SweepExpiredAcrossPartitionsResult = {
  readonly removed: number;
  readonly partitions: number;
};

function resolveSqlClient(opts: MatchmakerOptions): SqlClient {
  if (opts.sqlClient !== undefined) return opts.sqlClient;
  if (opts.pool !== undefined) return createPgSqlClient(opts.pool);
  throw new Error('Matchmaker requires either `pool` or `sqlClient`');
}

function rowToParticipant(row: ParticipantRow): MatchedParticipant {
  const data = asKeywordRecord(row.data, 'matchmaking peer data');
  return {
    participantId: row.id,
    joinedAt: row.joined_at,
    data,
    metadata: row.metadata,
  };
}

function assertPartitionSignature(signature: string, label: string): void {
  assert.ok(
    typeof signature === 'string',
    `${label}: partitionSignature must be a string`,
    { signature }
  );
}

/**
 * Normalises and validates a caller-supplied `groupSize`. Returns the
 * integer to send to SQL. `undefined` becomes the minimum (2 — the
 * pairwise default).
 *
 * @internal
 */
function resolveGroupSize(value: number | undefined, label: string): number {
  if (value === undefined) return MATCHMAKING_MIN_GROUP_SIZE;
  assert.ok(Number.isInteger(value), `${label}: groupSize must be an integer`, {
    groupSize: value,
  });
  assert.ok(
    value >= MATCHMAKING_MIN_GROUP_SIZE && value <= MATCHMAKING_MAX_GROUP_SIZE,
    `${label}: groupSize must be between ${String(MATCHMAKING_MIN_GROUP_SIZE)} and ${String(MATCHMAKING_MAX_GROUP_SIZE)}`,
    { groupSize: value }
  );
  return value;
}

/**
 * Normalises and validates a caller-supplied `priority`. Returns the
 * integer to send to SQL. `undefined` becomes 0 (FIFO).
 *
 * @internal
 */
function resolvePriority(value: number | undefined, label: string): number {
  if (value === undefined) return 0;
  assert.ok(Number.isInteger(value), `${label}: priority must be an integer`, {
    priority: value,
  });
  assert.ok(
    value >= MATCHMAKING_MIN_PRIORITY && value <= MATCHMAKING_MAX_PRIORITY,
    `${label}: priority must be between ${String(MATCHMAKING_MIN_PRIORITY)} and ${String(MATCHMAKING_MAX_PRIORITY)}`,
    { priority: value }
  );
  return value;
}

const METADATA_UTF8 = new TextEncoder();

/**
 * Normalises and validates a caller-supplied `metadata` blob. Returns
 * either the original object (passed straight to JSONB) or `null` when
 * unset / explicitly nulled.
 *
 * @internal
 */
function resolveMetadata(
  value: Record<string, unknown> | null | undefined,
  label: string
): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  assert.record(value, `${label}: metadata must be a plain object or null`);
  const encoded = JSON.stringify(value);
  const bytes = METADATA_UTF8.encode(encoded).length;
  assert.ok(
    bytes <= MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes,
    `${label}: metadata JSON must be at most ${String(MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes)} bytes (UTF-8)`,
    { bytes }
  );
  return value;
}

function assertOptionInvariants(opts: {
  readonly maxPairsPerPass: number;
  readonly bucketWidth: number;
  readonly matchedRetentionSeconds: number;
}): void {
  assert.ok(
    Number.isFinite(opts.maxPairsPerPass) && opts.maxPairsPerPass > 0,
    'Matchmaker: maxPairsPerPass must be a positive finite number',
    { maxPairsPerPass: opts.maxPairsPerPass }
  );
  assert.ok(
    Number.isFinite(opts.bucketWidth) && opts.bucketWidth > 0,
    'Matchmaker: bucketWidth must be a positive finite number',
    { bucketWidth: opts.bucketWidth }
  );
  assert.ok(
    Number.isFinite(opts.matchedRetentionSeconds) &&
      opts.matchedRetentionSeconds >= 0,
    'Matchmaker: matchedRetentionSeconds must be a non-negative finite number',
    { matchedRetentionSeconds: opts.matchedRetentionSeconds }
  );
}

/** @internal */
type SchemaDriftCallback = (expected: string, actual: string) => never;

export class Matchmaker {
  private readonly sqlClient: SqlClient;
  private readonly radius: RadiusOptions;
  private readonly clock: (() => number) | undefined;
  private readonly maxPairsPerPass: number;
  private readonly maxWaitSeconds: number | undefined;
  private readonly bucketWidth: number;
  private readonly partitionKeys: readonly string[];
  private readonly matchedRetentionSeconds: number;
  private readonly schemaFingerprint: string | undefined;
  private readonly onSchemaDrift: SchemaDriftCallback | undefined;
  /**
   * Three-state cache:
   *   - undefined: probe not yet attempted this process
   *   - true: probe ran and the DB fingerprint matched
   *   - false: probe ran and the DB fingerprint mismatched (we
   *     already threw on the first call; subsequent calls re-throw)
   */
  private fingerprintProbeOk: boolean | undefined;

  constructor(opts: MatchmakerOptions) {
    this.sqlClient = resolveSqlClient(opts);
    this.radius = opts.radius ?? DEFAULT_RADIUS_OPTIONS;
    this.clock = opts.now;
    this.maxPairsPerPass = opts.maxPairsPerPass ?? DEFAULT_MAX_PAIRS_PER_PASS;
    this.maxWaitSeconds = opts.maxWaitSeconds;
    this.bucketWidth = opts.bucketWidth ?? DEFAULT_BUCKET_WIDTH;
    this.partitionKeys = opts.partitionKeys ?? [];
    this.matchedRetentionSeconds =
      opts.matchedRetentionSeconds ?? DEFAULT_MATCHED_RETENTION_SECONDS;
    this.schemaFingerprint =
      opts.schema === undefined
        ? undefined
        : fingerprintForOptions(opts.schema);
    this.onSchemaDrift = opts.onSchemaDrift;
    this.fingerprintProbeOk = undefined;
    assertOptionInvariants({
      maxPairsPerPass: this.maxPairsPerPass,
      bucketWidth: this.bucketWidth,
      matchedRetentionSeconds: this.matchedRetentionSeconds,
    });
  }

  /**
   * Computes the same `partition_signature` string the SQL generated
   * column produces. Used by the HTTP layer to scope opportunistic match
   * passes to the partition the joining / polling participant lives in.
   *
   * Mirror invariant: this MUST stay byte-equivalent to
   * `partitionSignatureExpr` in `migrate.ts`. Mismatch silently emits
   * wrong signatures → zero matches.
   *
   * @internal
   */
  partitionSignatureFor(data: Record<string, unknown>): string {
    if (this.partitionKeys.length === 0) return '';
    const parts: string[] = [];
    for (const key of this.partitionKeys) {
      const v = data[key];
      parts.push(v === undefined || v === null ? '' : String(v));
    }
    return parts.join(PARTITION_SIGNATURE_SEPARATOR);
  }

  async join(input: JoinInput): Promise<JoinResult> {
    assert.defined(input, 'Matchmaker.join: input required');
    assert.record(input.data, 'Matchmaker.join: data must be an object');
    assertKeywordRecord(assert, input.data, 'Matchmaker.join: data');
    assert.array(input.formulas, 'Matchmaker.join: formulas must be an array');
    assert.ok(
      input.formulas.length > 0,
      'Matchmaker.join: formulas must be non-empty'
    );
    assert.ok(
      input.formulas.length <= MAX_FORMULAS_PER_PARTICIPANT,
      `Matchmaker.join: formulas must contain at most ${String(MAX_FORMULAS_PER_PARTICIPANT)} entries`,
      { count: input.formulas.length }
    );
    for (let i = 0; i < input.formulas.length; i += 1) {
      const label = `Matchmaker.join: formulas[${String(i)}]`;
      const formula: DistanceFormula | undefined = input.formulas[i];
      assert.defined(formula, `${label}: formula required`);
      assertFormula(formula, label);
      assertDataMatchesFormula(input.data, formula, label);
    }
    const groupSize = resolveGroupSize(input.groupSize, 'Matchmaker.join');
    const priority = resolvePriority(input.priority, 'Matchmaker.join');
    const metadata = resolveMetadata(input.metadata, 'Matchmaker.join');

    await this.assertSchemaFingerprint();
    const wire = input.formulas.map(serializeFormula);
    return this.insertJoin(input.data, wire, groupSize, priority, metadata);
  }

  /**
   * Wire-shaped escape hatch for HTTP / RPC boundaries that can't carry
   * `AttributeTag` objects (parsers, etc.). Performs shape-level validation
   * on the formulas; per-formula numeric/data alignment is enforced by the
   * SQL `matchmaking_pair_distance` helper at match-pass time (a missing
   * numeric attr raises there).
   *
   * @internal
   */
  async joinRaw(input: JoinInputRaw): Promise<JoinResult> {
    assert.defined(input, 'Matchmaker.joinRaw: input required');
    assert.record(input.data, 'Matchmaker.joinRaw: data must be an object');
    assertKeywordRecord(assert, input.data, 'Matchmaker.joinRaw: data');
    assert.array(
      input.formulas,
      'Matchmaker.joinRaw: formulas must be an array'
    );
    assert.ok(
      input.formulas.length > 0,
      'Matchmaker.joinRaw: formulas must be non-empty'
    );
    assert.ok(
      input.formulas.length <= MAX_FORMULAS_PER_PARTICIPANT,
      `Matchmaker.joinRaw: formulas must contain at most ${String(MAX_FORMULAS_PER_PARTICIPANT)} entries`,
      { count: input.formulas.length }
    );
    for (let i = 0; i < input.formulas.length; i += 1) {
      const label = `Matchmaker.joinRaw: formulas[${String(i)}]`;
      const wire: FormulaWire | undefined = input.formulas[i];
      assert.defined(wire, `${label}: formula required`);
      assertWireFormula(wire, label);
    }
    const groupSize = resolveGroupSize(input.groupSize, 'Matchmaker.joinRaw');
    const priority = resolvePriority(input.priority, 'Matchmaker.joinRaw');
    const metadata = resolveMetadata(input.metadata, 'Matchmaker.joinRaw');
    await this.assertSchemaFingerprint();
    return this.insertJoin(
      input.data,
      input.formulas,
      groupSize,
      priority,
      metadata
    );
  }

  private async insertJoin(
    data: AttributeState,
    formulas: readonly FormulaWire[],
    groupSize: number,
    priority: number,
    metadata: Record<string, unknown> | null
  ): Promise<JoinResult> {
    // Single CTE: INSERT into waiting + UPSERT into active_partitions in
    // one round-trip. The active_partitions row is observed by the
    // tick fan-out so the (signature, group_size) pair wakes up on
    // the next tick.
    const signature = this.partitionSignatureFor(data);
    const result = await this.sqlClient.query<{ id: string }>(
      `WITH ins AS (
         INSERT INTO matchmaking_waiting
           (data, formulas, partition_signature, group_size, priority, metadata)
         VALUES ($1::jsonb, $2::jsonb, $3, $4, $5, $6::jsonb)
         RETURNING id
       ), reg AS (
         INSERT INTO matchmaking_active_partitions
           (partition_signature, group_size)
         VALUES ($3, $4)
         ON CONFLICT (partition_signature, group_size) DO NOTHING
         RETURNING partition_signature
       )
       SELECT id FROM ins`,
      [
        JSON.stringify(data),
        JSON.stringify(formulas),
        signature,
        groupSize,
        priority,
        metadata === null ? null : JSON.stringify(metadata),
      ]
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('matchmaking insert returned no rows');
    }
    return { participantId: row.id };
  }

  /**
   * Replaces the formulas for a waiting participant. Preserves
   * `joined_at` (no queue-position penalty) and the partition signature
   * (formulas can't change the partition layout the row was hashed
   * into). Returns `{ updated: false }` when the participant is not in
   * `matchmaking_waiting` — either matched, swept, or unknown.
   *
   * Validation re-uses `assertFormula` so the same shape rules apply
   * as on `join`.
   */
  async updateFormulas(
    participantId: string,
    formulas: readonly DistanceFormula[]
  ): Promise<UpdateFormulasResult> {
    assert.nonEmptyString(
      participantId,
      'Matchmaker.updateFormulas: participantId must be a non-empty string'
    );
    assert.array(
      formulas,
      'Matchmaker.updateFormulas: formulas must be an array'
    );
    assert.ok(
      formulas.length > 0,
      'Matchmaker.updateFormulas: formulas must be non-empty'
    );
    assert.ok(
      formulas.length <= MAX_FORMULAS_PER_PARTICIPANT,
      `Matchmaker.updateFormulas: formulas must contain at most ${String(MAX_FORMULAS_PER_PARTICIPANT)} entries`,
      { count: formulas.length }
    );
    for (let i = 0; i < formulas.length; i += 1) {
      const label = `Matchmaker.updateFormulas: formulas[${String(i)}]`;
      const formula: DistanceFormula | undefined = formulas[i];
      assert.defined(formula, `${label}: formula required`);
      assertFormula(formula, label);
    }
    const wire = formulas.map(serializeFormula);
    return this.updateFormulasInner(participantId, wire);
  }

  /**
   * Wire-shaped variant of {@link updateFormulas}, mirroring the
   * relationship between `join` and `joinRaw`. Performs shape-level
   * validation only.
   *
   * @internal
   */
  async updateFormulasRaw(
    participantId: string,
    input: UpdateFormulasInputRaw
  ): Promise<UpdateFormulasResult> {
    assert.nonEmptyString(
      participantId,
      'Matchmaker.updateFormulasRaw: participantId must be a non-empty string'
    );
    assert.defined(input, 'Matchmaker.updateFormulasRaw: input required');
    assert.array(
      input.formulas,
      'Matchmaker.updateFormulasRaw: formulas must be an array'
    );
    assert.ok(
      input.formulas.length > 0,
      'Matchmaker.updateFormulasRaw: formulas must be non-empty'
    );
    assert.ok(
      input.formulas.length <= MAX_FORMULAS_PER_PARTICIPANT,
      `Matchmaker.updateFormulasRaw: formulas must contain at most ${String(MAX_FORMULAS_PER_PARTICIPANT)} entries`,
      { count: input.formulas.length }
    );
    for (let i = 0; i < input.formulas.length; i += 1) {
      const label = `Matchmaker.updateFormulasRaw: formulas[${String(i)}]`;
      const wire: FormulaWire | undefined = input.formulas[i];
      assert.defined(wire, `${label}: formula required`);
      assertWireFormula(wire, label);
    }
    return this.updateFormulasInner(participantId, input.formulas);
  }

  private async updateFormulasInner(
    participantId: string,
    formulas: readonly FormulaWire[]
  ): Promise<UpdateFormulasResult> {
    const result = await this.sqlClient.query<{ id: string }>(
      `UPDATE matchmaking_waiting
         SET formulas = $1::jsonb
       WHERE id = $2
       RETURNING id`,
      [JSON.stringify(formulas), participantId]
    );
    return { updated: result.rows.length > 0 };
  }

  /**
   * Removes a participant from the waiting set. Matched rows are
   * intentionally not removable — a paired participant has a contract
   * with their peer (the emitted `matchId`) that downstream code is
   * already acting on.
   */
  async leave(participantId: string): Promise<LeaveResult> {
    assert.nonEmptyString(
      participantId,
      'Matchmaker.leave: participantId must be a non-empty string'
    );
    const result = await this.sqlClient.query<{ id: string }>(
      `DELETE FROM matchmaking_waiting WHERE id = $1 RETURNING id`,
      [participantId]
    );
    return { removed: result.rows.length > 0 };
  }

  /**
   * Single-statement read across the waiting + matched tables. The
   * UNION ALL planner does two PK seeks (one per table); at most one
   * returns a row because `id` is the PK of both. For matched rows we
   * issue a second indexed SELECT to fetch peers by `match_id`.
   */
  async status(participantId: string): Promise<StatusResult | null> {
    assert.nonEmptyString(
      participantId,
      'Matchmaker.status: participantId must be a non-empty string'
    );
    const result = await this.sqlClient.query<StatusRow>(
      `SELECT 'waiting'::TEXT AS status, data, metadata, NULL::UUID AS match_id
       FROM matchmaking_waiting WHERE id = $1
       UNION ALL
       SELECT 'matched'::TEXT AS status, data, metadata, match_id
       FROM matchmaking_matched WHERE id = $1
       LIMIT 1`,
      [participantId]
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const data = asKeywordRecord(row.data, 'matchmaking status data');
    if (row.status === 'waiting') {
      return { status: 'waiting', data, metadata: row.metadata ?? null };
    }
    if (row.match_id === null) {
      throw new Error(
        `matchmaking row ${participantId} is matched but has no match_id`
      );
    }
    const peers = await this.sqlClient.query<ParticipantRow>(
      `SELECT id, joined_at, data, metadata
       FROM matchmaking_matched
       WHERE match_id = $1 AND id <> $2
       ORDER BY joined_at`,
      [row.match_id, participantId]
    );
    return {
      status: 'matched',
      data,
      metadata: row.metadata ?? null,
      matchId: row.match_id,
      peers: peers.rows.map(rowToParticipant),
    };
  }

  /**
   * One bounded match pass for ONE (partition, group_size) pair.
   * Returns the number of groups produced. Returns 0 when there's no
   * work to do.
   *
   * Pass `''` for single-partition (no `partitionKeys`) deployments.
   * `groupSize` defaults to 2 (the head-to-head case).
   *
   * @internal
   */
  async runMatchPass(
    partitionSignature: string,
    groupSize: number = MATCHMAKING_MIN_GROUP_SIZE
  ): Promise<_MatchPassResult> {
    assertPartitionSignature(partitionSignature, 'Matchmaker.runMatchPass');
    const resolvedGroupSize = resolveGroupSize(
      groupSize,
      'Matchmaker.runMatchPass'
    );
    const nowParam = this.nowParam();
    const result = await this.sqlClient.query<MatchPassRow>(
      `SELECT match_id, participant_id, joined_at, data
       FROM matchmaking_run_match_pass($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        partitionSignature,
        this.radius.baseRadius,
        this.radius.radiusGrowthPerSecond,
        this.radius.maxRadius,
        this.maxPairsPerPass,
        this.bucketWidth,
        resolvedGroupSize,
        nowParam,
      ]
    );
    const matchIds = new Set<string>();
    for (const r of result.rows) matchIds.add(r.match_id);
    return { matches: matchIds.size };
  }

  /**
   * Drain loop for ONE (partition, group_size) pair: calls
   * `runMatchPass` until it returns 0 matches or `maxPasses` is hit.
   * Passing a `signal` lets long-running drains be cancelled mid-loop.
   *
   * @internal
   */
  async runMatchPasses(
    partitionSignature: string,
    opts: RunMatchPassesOptions = {}
  ): Promise<RunMatchPassesResult> {
    assertPartitionSignature(partitionSignature, 'Matchmaker.runMatchPasses');
    const maxPasses = opts.maxPasses ?? DEFAULT_MAX_PASSES_DRAIN;
    assert.ok(
      Number.isFinite(maxPasses) && maxPasses > 0,
      'Matchmaker.runMatchPasses: maxPasses must be a positive finite number',
      { maxPasses }
    );
    const groupSize = opts.groupSize ?? MATCHMAKING_MIN_GROUP_SIZE;
    let matches = 0;
    let passes = 0;
    while (passes < maxPasses) {
      if (opts.signal?.aborted === true) break;
      const result = await this.runMatchPass(partitionSignature, groupSize);
      passes += 1;
      matches += result.matches;
      if (result.matches === 0) break;
    }
    return { matches, passes };
  }

  /**
   * Fan-out drain across every currently-active `(partition, group_size)`
   * pair. Reads pairs from `matchmaking_active_partitions` (tiny
   * tracker table populated on `/join`) and drains each in parallel
   * with bounded concurrency. Empty pairs get pruned from the tracker
   * table as part of the same call.
   *
   * @internal
   */
  async runMatchPassesAcrossPartitions(
    opts: RunMatchPassesAcrossPartitionsOptions = {}
  ): Promise<RunMatchPassesAcrossPartitionsResult> {
    const pairs = await this.discoverActivePartitions(opts.maxPartitions);
    if (pairs.length === 0) return { matches: 0, passes: 0, partitions: 0 };
    const concurrency = opts.concurrency ?? DEFAULT_DRAIN_CONCURRENCY;
    const maxPassesPerPartition =
      opts.maxPassesPerPartition ?? DEFAULT_MAX_PASSES_DRAIN;
    const results = await parallelMap(
      pairs,
      concurrency,
      (pair) =>
        this.runMatchPasses(pair.partitionSignature, {
          maxPasses: maxPassesPerPartition,
          groupSize: pair.groupSize,
          ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
        }),
      opts.signal
    );
    let matches = 0;
    let passes = 0;
    for (const r of results) {
      if (r === undefined) continue;
      matches += r.matches;
      passes += r.passes;
    }
    // Best-effort prune of (sig, group_size) pairs that drained to
    // zero waiters. Single statement; safe to call repeatedly.
    await this.sqlClient.query(
      `DELETE FROM matchmaking_active_partitions ap
       WHERE NOT EXISTS (
         SELECT 1 FROM matchmaking_waiting w
         WHERE w.partition_signature = ap.partition_signature
           AND w.group_size = ap.group_size
       )`
    );
    return { matches, passes, partitions: pairs.length };
  }

  /**
   * Removes abandoned waiters older than `maxWaitSeconds` IN ONE
   * partition. No-op when `maxWaitSeconds` was not configured.
   *
   * @internal
   */
  async sweepExpired(partitionSignature: string): Promise<SweepExpiredResult> {
    assertPartitionSignature(partitionSignature, 'Matchmaker.sweepExpired');
    if (this.maxWaitSeconds === undefined) return { removed: 0 };
    const nowParam = this.nowParam();
    const result = await this.sqlClient.query<{
      matchmaking_sweep_expired: number | string;
    }>(
      `SELECT matchmaking_sweep_expired($1, $2, $3) AS matchmaking_sweep_expired`,
      [partitionSignature, this.maxWaitSeconds, nowParam]
    );
    const raw = result.rows[0]?.matchmaking_sweep_expired ?? 0;
    const removed = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
    return { removed };
  }

  /**
   * Fan-out sweep across every currently-active partition, in parallel
   * with bounded concurrency. Sweep ignores `group_size` — abandoned
   * waiters are dropped regardless of which group they were destined
   * for, so we dedupe by signature first to avoid double-sweeping.
   *
   * @internal
   */
  async sweepExpiredAcrossPartitions(
    opts: SweepExpiredAcrossPartitionsOptions = {}
  ): Promise<SweepExpiredAcrossPartitionsResult> {
    if (this.maxWaitSeconds === undefined) {
      return { removed: 0, partitions: 0 };
    }
    const pairs = await this.discoverActivePartitions(opts.maxPartitions);
    if (pairs.length === 0) return { removed: 0, partitions: 0 };
    const uniqueSigs = Array.from(
      new Set(pairs.map((p) => p.partitionSignature))
    );
    const concurrency = opts.concurrency ?? DEFAULT_DRAIN_CONCURRENCY;
    const results = await parallelMap(uniqueSigs, concurrency, (sig) =>
      this.sweepExpired(sig)
    );
    let removed = 0;
    for (const r of results) {
      if (r === undefined) continue;
      removed += r.removed;
    }
    return { removed, partitions: uniqueSigs.length };
  }

  /**
   * Global cleanup of matched rows older than `matchedRetentionSeconds`.
   * Single indexed range DELETE on `matchmaking_matched_matched_at_idx`.
   *
   * @internal
   */
  async sweepMatched(): Promise<SweepMatchedResult> {
    if (this.matchedRetentionSeconds <= 0) return { removed: 0 };
    const nowParam = this.nowParam();
    const result = await this.sqlClient.query<{
      matchmaking_sweep_matched: number | string;
    }>(
      `SELECT matchmaking_sweep_matched($1, $2) AS matchmaking_sweep_matched`,
      [this.matchedRetentionSeconds, nowParam]
    );
    const raw = result.rows[0]?.matchmaking_sweep_matched ?? 0;
    const removed = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
    return { removed };
  }

  /**
   * Lazy schema-drift probe: on the FIRST join call per process,
   * compare the schema fingerprint baked into this Matchmaker
   * (computed from `MatchmakingSchema`) against the fingerprint
   * `migrate()` last wrote into `matchmaking_schema_state`. When they
   * disagree, fire the `onSchemaDrift` callback (which throws a typed
   * `MatchmakingSchemaDriftError`).
   *
   * Cached so the cost is amortised to one extra SELECT per process,
   * not one per join. A successful probe stays positive for the
   * lifetime of the process; a failed probe stays negative so the
   * caller keeps hitting the loud error instead of producing zero
   * matches.
   *
   * Skipped entirely when the Matchmaker was constructed without a
   * `schema` (direct tests that don't go through the public facade).
   *
   * @internal
   */
  private async assertSchemaFingerprint(): Promise<void> {
    const expected = this.schemaFingerprint;
    const onDrift = this.onSchemaDrift;
    if (expected === undefined || onDrift === undefined) return;
    if (this.fingerprintProbeOk === true) return;
    const state = await this.sqlClient.query<{ schema_fingerprint: string }>(
      `SELECT schema_fingerprint FROM matchmaking_schema_state WHERE id = 1`
    );
    // Missing row means `migrate()` never ran for this DB; treat the
    // same as drift. The public facade always migrates as part of
    // construction so this is only reachable when someone bypasses
    // `Matchmaking` entirely.
    const actual = state.rows[0]?.schema_fingerprint ?? '<not migrated>';
    if (actual !== expected) {
      this.fingerprintProbeOk = false;
      onDrift(expected, actual);
    }
    this.fingerprintProbeOk = true;
  }

  private async discoverActivePartitions(
    maxPartitions: number | undefined
  ): Promise<readonly ActivePartition[]> {
    const cap = maxPartitions ?? DEFAULT_MAX_PARTITIONS_FANOUT;
    assert.ok(
      Number.isFinite(cap) && cap > 0,
      'Matchmaker: maxPartitions must be a positive finite number',
      { maxPartitions: cap }
    );
    const result = await this.sqlClient.query<{
      partition_signature: string;
      group_size: number | string;
    }>(
      `SELECT partition_signature, group_size
       FROM matchmaking_active_partitions
       ORDER BY first_seen_at
       LIMIT $1`,
      [cap]
    );
    return result.rows.map((r) => ({
      partitionSignature: r.partition_signature,
      groupSize:
        typeof r.group_size === 'string'
          ? Number.parseInt(r.group_size, 10)
          : r.group_size,
    }));
  }

  private nowParam(): string | null {
    if (this.clock === undefined) return null;
    return new Date(this.clock()).toISOString();
  }
}
