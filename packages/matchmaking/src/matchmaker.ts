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
 * Internal class: this is consumed by the public {@link Matchmaking}
 * class (which owns migrate, throttle defaults, the Hono app, and the
 * `tick()` ops method). It is NOT exported from the package's `index.ts`.
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
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';
import {
  DEFAULT_RADIUS_OPTIONS,
  type DistanceFormula,
  type JoinInput,
  type JoinResult,
  type LeaveResult,
  type MatchPassResult,
  type MatchedParticipant,
  type ParticipantStatus,
  type RadiusOptions,
  type StatusResult,
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
};

type StatusRow = {
  readonly status: ParticipantStatus;
  readonly data: Record<string, unknown>;
  readonly match_id: string | null;
};

type ParticipantRow = {
  readonly id: string;
  readonly joined_at: Date;
  readonly data: Record<string, unknown>;
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
};

export type RunMatchPassesOptions = {
  readonly maxPasses?: number;
  readonly signal?: AbortSignal;
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
  };
}

function assertPartitionSignature(signature: string, label: string): void {
  assert.ok(
    typeof signature === 'string',
    `${label}: partitionSignature must be a string`,
    { signature }
  );
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

/**
 * Bounded-concurrency Promise.all. Runs `worker(item, index)` for each
 * input in parallel up to `limit` simultaneous in-flight tasks.
 * Preserves input order in the result array. Aborts cleanly when
 * `signal` is supplied and flips to aborted between tasks.
 */
async function parallelMap<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const cap = Math.max(1, Math.floor(limit));
  const out = new Array<R>(items.length);
  let next = 0;
  async function lane(): Promise<void> {
    while (true) {
      if (signal?.aborted === true) return;
      const i = next;
      next += 1;
      if (i >= items.length) return;
      const item = items[i] as T;
      out[i] = await worker(item, i);
    }
  }
  const lanes: Promise<void>[] = [];
  const n = Math.min(cap, items.length);
  for (let i = 0; i < n; i += 1) lanes.push(lane());
  await Promise.all(lanes);
  return out;
}

export class Matchmaker {
  private readonly sqlClient: SqlClient;
  private readonly radius: RadiusOptions;
  private readonly clock: (() => number) | undefined;
  private readonly maxPairsPerPass: number;
  private readonly maxWaitSeconds: number | undefined;
  private readonly bucketWidth: number;
  private readonly partitionKeys: readonly string[];
  private readonly matchedRetentionSeconds: number;

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

    const wire = input.formulas.map(serializeFormula);
    return this.insertJoin(input.data, wire);
  }

  /**
   * Wire-shaped escape hatch for HTTP / RPC boundaries that can't carry
   * `AttributeTag` objects (parsers, etc.). Performs shape-level validation
   * on the formulas; per-formula numeric/data alignment is enforced by the
   * SQL `matchmaking_pair_distance` helper at match-pass time (a missing
   * numeric attr raises there).
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
    return this.insertJoin(input.data, input.formulas);
  }

  private async insertJoin(
    data: AttributeState,
    formulas: readonly FormulaWire[]
  ): Promise<JoinResult> {
    // Single CTE: INSERT into waiting + UPSERT into active_partitions in
    // one round-trip. The active_partitions row is observed by the
    // ticker's `discoverActivePartitions` so the partition wakes up on
    // the next tick.
    //
    // partition_signature must be supplied by JS: Postgres forbids
    // generated columns as partition keys, so the column is a regular
    // TEXT NOT NULL fed from `partitionSignatureFor(data)`. JS-side
    // computation here must stay byte-equivalent to whatever the SQL
    // expression *would* have been — both derive from the same
    // `partitionKeys` declared on `MatchmakingSchema`.
    const signature = this.partitionSignatureFor(data);
    const result = await this.sqlClient.query<{ id: string }>(
      `WITH ins AS (
         INSERT INTO matchmaking_waiting (data, formulas, partition_signature)
         VALUES ($1::jsonb, $2::jsonb, $3)
         RETURNING id
       ), reg AS (
         INSERT INTO matchmaking_active_partitions (partition_signature)
         VALUES ($3)
         ON CONFLICT (partition_signature) DO NOTHING
         RETURNING partition_signature
       )
       SELECT id FROM ins`,
      [JSON.stringify(data), JSON.stringify(formulas), signature]
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('matchmaking insert returned no rows');
    }
    return { participantId: row.id };
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
      `SELECT 'waiting'::TEXT AS status, data, NULL::UUID AS match_id
       FROM matchmaking_waiting WHERE id = $1
       UNION ALL
       SELECT 'matched'::TEXT AS status, data, match_id
       FROM matchmaking_matched WHERE id = $1
       LIMIT 1`,
      [participantId]
    );
    const row = result.rows[0];
    if (row === undefined) return null;
    const data = asKeywordRecord(row.data, 'matchmaking status data');
    if (row.status === 'waiting') {
      return { status: 'waiting', data };
    }
    if (row.match_id === null) {
      throw new Error(
        `matchmaking row ${participantId} is matched but has no match_id`
      );
    }
    const peers = await this.sqlClient.query<ParticipantRow>(
      `SELECT id, joined_at, data
       FROM matchmaking_matched
       WHERE match_id = $1 AND id <> $2
       ORDER BY joined_at`,
      [row.match_id, participantId]
    );
    return {
      status: 'matched',
      data,
      matchId: row.match_id,
      peers: peers.rows.map(rowToParticipant),
    };
  }

  /**
   * One bounded match pass for ONE partition. Returns the number of
   * pairs produced. Returns 0 when there's no work to do.
   *
   * Pass `''` for single-partition (no `partitionKeys`) deployments.
   */
  async runMatchPass(partitionSignature: string): Promise<MatchPassResult> {
    assertPartitionSignature(partitionSignature, 'Matchmaker.runMatchPass');
    const nowParam = this.nowParam();
    const result = await this.sqlClient.query<MatchPassRow>(
      `SELECT match_id, participant_id, joined_at, data
       FROM matchmaking_run_match_pass($1, $2, $3, $4, $5, $6, $7)`,
      [
        partitionSignature,
        this.radius.baseRadius,
        this.radius.radiusGrowthPerSecond,
        this.radius.maxRadius,
        this.maxPairsPerPass,
        this.bucketWidth,
        nowParam,
      ]
    );
    const matchIds = new Set<string>();
    for (const r of result.rows) matchIds.add(r.match_id);
    return { matches: matchIds.size };
  }

  /**
   * Drain loop for ONE partition: calls `runMatchPass` until it returns 0
   * matches or `maxPasses` is hit. Passing a `signal` lets long-running
   * drains be cancelled mid-loop.
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
    let matches = 0;
    let passes = 0;
    while (passes < maxPasses) {
      if (opts.signal?.aborted === true) break;
      const result = await this.runMatchPass(partitionSignature);
      passes += 1;
      matches += result.matches;
      if (result.matches === 0) break;
    }
    return { matches, passes };
  }

  /**
   * Fan-out drain across every currently-active partition. Reads
   * partition signatures from `matchmaking_active_partitions` (tiny
   * tracker table populated on `/join`) and drains each in parallel
   * with bounded concurrency. Empty partitions get pruned from the
   * tracker table as part of the same call.
   */
  async runMatchPassesAcrossPartitions(
    opts: RunMatchPassesAcrossPartitionsOptions = {}
  ): Promise<RunMatchPassesAcrossPartitionsResult> {
    const sigs = await this.discoverActivePartitions(opts.maxPartitions);
    if (sigs.length === 0) return { matches: 0, passes: 0, partitions: 0 };
    const concurrency = opts.concurrency ?? DEFAULT_DRAIN_CONCURRENCY;
    const maxPassesPerPartition =
      opts.maxPassesPerPartition ?? DEFAULT_MAX_PASSES_DRAIN;
    const passOpts: RunMatchPassesOptions = {
      maxPasses: maxPassesPerPartition,
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    };
    const results = await parallelMap(
      sigs,
      concurrency,
      (sig) => this.runMatchPasses(sig, passOpts),
      opts.signal
    );
    let matches = 0;
    let passes = 0;
    for (const r of results) {
      matches += r.matches;
      passes += r.passes;
    }
    // Best-effort prune of partitions that drained to zero waiters.
    // Single statement; safe to call repeatedly.
    await this.sqlClient.query(
      `DELETE FROM matchmaking_active_partitions ap
       WHERE NOT EXISTS (
         SELECT 1 FROM matchmaking_waiting w
         WHERE w.partition_signature = ap.partition_signature
       )`
    );
    return { matches, passes, partitions: sigs.length };
  }

  /**
   * Removes abandoned waiters older than `maxWaitSeconds` IN ONE
   * partition. No-op when `maxWaitSeconds` was not configured.
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
   * with bounded concurrency.
   */
  async sweepExpiredAcrossPartitions(
    opts: SweepExpiredAcrossPartitionsOptions = {}
  ): Promise<SweepExpiredAcrossPartitionsResult> {
    if (this.maxWaitSeconds === undefined) {
      return { removed: 0, partitions: 0 };
    }
    const sigs = await this.discoverActivePartitions(opts.maxPartitions);
    if (sigs.length === 0) return { removed: 0, partitions: 0 };
    const concurrency = opts.concurrency ?? DEFAULT_DRAIN_CONCURRENCY;
    const results = await parallelMap(sigs, concurrency, (sig) =>
      this.sweepExpired(sig)
    );
    let removed = 0;
    for (const r of results) removed += r.removed;
    return { removed, partitions: sigs.length };
  }

  /**
   * Global cleanup of matched rows older than `matchedRetentionSeconds`.
   * Single indexed range DELETE on `matchmaking_matched_matched_at_idx`.
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

  private async discoverActivePartitions(
    maxPartitions: number | undefined
  ): Promise<readonly string[]> {
    const cap = maxPartitions ?? DEFAULT_MAX_PARTITIONS_FANOUT;
    assert.ok(
      Number.isFinite(cap) && cap > 0,
      'Matchmaker: maxPartitions must be a positive finite number',
      { maxPartitions: cap }
    );
    const result = await this.sqlClient.query<{
      partition_signature: string;
    }>(
      `SELECT partition_signature
       FROM matchmaking_active_partitions
       ORDER BY first_seen_at
       LIMIT $1`,
      [cap]
    );
    return result.rows.map((r) => r.partition_signature);
  }

  private nowParam(): string | null {
    if (this.clock === undefined) return null;
    return new Date(this.clock()).toISOString();
  }
}
