/**
 * Thin wrapper around the Postgres-owned matchmaking schema.
 *
 * Every queue mutation is a single SQL statement; `runMatchPass` calls the
 * server-side `matchmaking_run_match_pass()` function which does the
 * locking, throttling, formula-driven distance computation, pairing,
 * status flip, and match-id minting inside one PL/pgSQL routine. The only
 * state held in JS is the radius / throttle config the constructor
 * receives — no in-memory queue mirror, no in-flight match buffer, no
 * pairing algorithm.
 *
 * Per-participant formulas: each `join()` carries a non-empty ORDERED list
 * of `DistanceFormula`s the participant is willing to accept; the SQL
 * function picks the first mutually-satisfied pair. There is no global
 * formula and no completion callback — callers poll `status(participantId)`
 * and read the emitted `matchId` to bring the match online (e.g. as a
 * Durable Object).
 *
 * Partition-scoped passes (chess.com-scale): `runMatchPass(sig)` /
 * `sweepExpired(sig)` operate on ONE partition. Different partitions run
 * in parallel through Postgres (per-partition throttle rows, per-partition
 * snapshot CTE). `runMatchPassesAcrossPartitions` / `sweepExpiredAcrossPartitions`
 * fan out across every active partition for admin tooling and tests.
 *
 * Throttling: every pass / sweep is safe to call on every request. The
 * SQL function takes `FOR UPDATE SKIP LOCKED` on a per-(partition, kind)
 * coalesce row and short-circuits when another pass is in flight OR when
 * the last pass happened less than `minPassIntervalMs` ago. A returned
 * `{ matches: 0 }` therefore means "no work done" — could be queue-empty,
 * could be throttled. Callers don't need to distinguish.
 *
 * Tiger-style asserts run at every boundary:
 *   - `join()` validates `data` is an `AttributeState`, `formulas` is
 *     a non-empty array bounded by {@link MAX_FORMULAS_PER_PARTICIPANT},
 *     and every formula's numeric tags resolve to a finite number from
 *     `data`.
 *   - `status()` re-brands the JSONB rows coming back from the DB as
 *     `AttributeState` via `asKeywordRecord`.
 *   - First SQL call asserts the schema fingerprint matches what
 *     `migrate()` installed, catching `partitionKeys` mismatch loudly.
 *
 * The library is use-case agnostic — it doesn't assume matches are
 * competitive, cooperative, conversational, or anything else. The caller
 * decides the meaning through `data` and `formulas`.
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
import { fingerprintForOptions } from './migrate';
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

const DEFAULT_MAX_PAIRS_PER_PASS = 100;
const DEFAULT_MIN_PASS_INTERVAL_MS = 100;
const DEFAULT_SWEEP_INTERVAL_MS = 60_000;
const DEFAULT_BUCKET_WIDTH = 50;
const DEFAULT_MAX_PASSES_DRAIN = 8;
const DEFAULT_MAX_PARTITIONS_FANOUT = 1024;
const DEFAULT_MATCHED_RETENTION_SECONDS = 3600;

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
   * Maximum pairs emitted per `runMatchPass()` call. Bounds the cost of
   * one pass so opportunistic callers (request handlers) stay cheap.
   * Default {@link DEFAULT_MAX_PAIRS_PER_PASS}.
   */
  readonly maxPairsPerPass?: number;
  /**
   * Server-side throttle floor. The SQL function refuses to run a pass
   * if the previous successful pass was less than this many milliseconds
   * ago. Set to `0` in tests to disable. Default {@link DEFAULT_MIN_PASS_INTERVAL_MS}.
   */
  readonly minPassIntervalMs?: number;
  /**
   * When set, `sweepExpired()` deletes waiting rows older than this.
   * Default `undefined` (sweep is a no-op).
   */
  readonly maxWaitSeconds?: number;
  /**
   * Server-side throttle floor for `sweepExpired()` and `sweepMatched()`.
   * Default {@link DEFAULT_SWEEP_INTERVAL_MS}.
   */
  readonly sweepIntervalMs?: number;
  /**
   * Hard partition keys, must match what was declared on `migrate()`.
   * Default empty (one global shard). `partitionSignatureFor` and the
   * lazy schema-fingerprint assert both depend on this matching the DB.
   */
  readonly partitionKeys?: readonly string[];
  /**
   * The single numeric attribute declared on `migrate()`. Only used for
   * the lazy schema-fingerprint assert — the SQL itself reads the value
   * out of the generated column.
   */
  readonly primaryNumericKey?: string;
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
  readonly signal?: AbortSignal;
};

export type RunMatchPassesAcrossPartitionsResult = {
  readonly matches: number;
  readonly passes: number;
  readonly partitions: number;
};

export type SweepExpiredAcrossPartitionsOptions = {
  readonly maxPartitions?: number;
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
  readonly minPassIntervalMs: number;
  readonly sweepIntervalMs: number;
  readonly bucketWidth: number;
  readonly matchedRetentionSeconds: number;
}): void {
  assert.ok(
    Number.isFinite(opts.maxPairsPerPass) && opts.maxPairsPerPass > 0,
    'Matchmaker: maxPairsPerPass must be a positive finite number',
    { maxPairsPerPass: opts.maxPairsPerPass }
  );
  assert.ok(
    Number.isFinite(opts.minPassIntervalMs) && opts.minPassIntervalMs >= 0,
    'Matchmaker: minPassIntervalMs must be a non-negative finite number',
    { minPassIntervalMs: opts.minPassIntervalMs }
  );
  assert.ok(
    Number.isFinite(opts.sweepIntervalMs) && opts.sweepIntervalMs >= 0,
    'Matchmaker: sweepIntervalMs must be a non-negative finite number',
    { sweepIntervalMs: opts.sweepIntervalMs }
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

export class Matchmaker {
  private readonly sqlClient: SqlClient;
  private readonly radius: RadiusOptions;
  private readonly clock: (() => number) | undefined;
  private readonly maxPairsPerPass: number;
  private readonly minPassIntervalMs: number;
  private readonly maxWaitSeconds: number | undefined;
  private readonly sweepIntervalMs: number;
  private readonly bucketWidth: number;
  private readonly partitionKeys: readonly string[];
  private readonly primaryNumericKey: string | undefined;
  private readonly matchedRetentionSeconds: number;
  private readonly expectedFingerprint: string;
  private fingerprintChecked: boolean = false;

  constructor(opts: MatchmakerOptions) {
    this.sqlClient = resolveSqlClient(opts);
    this.radius = opts.radius ?? DEFAULT_RADIUS_OPTIONS;
    this.clock = opts.now;
    this.maxPairsPerPass = opts.maxPairsPerPass ?? DEFAULT_MAX_PAIRS_PER_PASS;
    this.minPassIntervalMs =
      opts.minPassIntervalMs ?? DEFAULT_MIN_PASS_INTERVAL_MS;
    this.maxWaitSeconds = opts.maxWaitSeconds;
    this.sweepIntervalMs = opts.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
    this.bucketWidth = opts.bucketWidth ?? DEFAULT_BUCKET_WIDTH;
    this.partitionKeys = opts.partitionKeys ?? [];
    this.primaryNumericKey = opts.primaryNumericKey;
    this.matchedRetentionSeconds =
      opts.matchedRetentionSeconds ?? DEFAULT_MATCHED_RETENTION_SECONDS;
    assertOptionInvariants({
      maxPairsPerPass: this.maxPairsPerPass,
      minPassIntervalMs: this.minPassIntervalMs,
      sweepIntervalMs: this.sweepIntervalMs,
      bucketWidth: this.bucketWidth,
      matchedRetentionSeconds: this.matchedRetentionSeconds,
    });
    // Build once and reuse — also doubles as construction-time validation
    // of partitionKeys / primaryNumericKey via `resolveSchema`.
    this.expectedFingerprint = fingerprintForOptions({
      partitionKeys: this.partitionKeys,
      ...(this.primaryNumericKey !== undefined
        ? { primaryNumericKey: this.primaryNumericKey }
        : {}),
      bucketWidth: this.bucketWidth,
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
    const result = await this.sqlClient.query<{ id: string }>(
      `INSERT INTO matchmaking_queue (data, formulas)
       VALUES ($1::jsonb, $2::jsonb)
       RETURNING id`,
      [JSON.stringify(data), JSON.stringify(formulas)]
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('matchmaking insert returned no rows');
    }
    return { participantId: row.id };
  }

  async leave(participantId: string): Promise<LeaveResult> {
    assert.nonEmptyString(
      participantId,
      'Matchmaker.leave: participantId must be a non-empty string'
    );
    const result = await this.sqlClient.query<{ id: string }>(
      `DELETE FROM matchmaking_queue WHERE id = $1 RETURNING id`,
      [participantId]
    );
    return { removed: result.rows.length > 0 };
  }

  async status(participantId: string): Promise<StatusResult | null> {
    assert.nonEmptyString(
      participantId,
      'Matchmaker.status: participantId must be a non-empty string'
    );
    const result = await this.sqlClient.query<StatusRow>(
      `SELECT status, data, match_id
       FROM matchmaking_queue
       WHERE id = $1`,
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
       FROM matchmaking_queue
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
   * pairs produced. Returns 0 when there's no work to do OR when the SQL
   * throttle short-circuited the call — both are normal, not errors.
   *
   * Pass `''` for single-partition (no `partitionKeys`) deployments.
   */
  async runMatchPass(partitionSignature: string): Promise<MatchPassResult> {
    assertPartitionSignature(partitionSignature, 'Matchmaker.runMatchPass');
    await this.assertSchemaMatches();
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
        this.minPassIntervalMs,
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
   * matches or `maxPasses` is hit. The min-interval throttle limits
   * per-loop cost; passing a `signal` lets long-running drains (e.g.
   * admin tooling) be cancelled mid-loop.
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
   * Fan-out drain across every currently-active partition. Discovers
   * partitions via a `SELECT DISTINCT partition_signature` (bounded by
   * `maxPartitions`) then runs a per-partition drain. Used by tests and
   * admin tooling; production hot-path scoping is done by the HTTP layer
   * computing the signature from the request body.
   */
  async runMatchPassesAcrossPartitions(
    opts: RunMatchPassesAcrossPartitionsOptions = {}
  ): Promise<RunMatchPassesAcrossPartitionsResult> {
    const sigs = await this.discoverActivePartitions(opts.maxPartitions);
    let matches = 0;
    let passes = 0;
    for (const sig of sigs) {
      if (opts.signal?.aborted === true) break;
      const passOpts: RunMatchPassesOptions = {
        maxPasses: opts.maxPassesPerPartition ?? DEFAULT_MAX_PASSES_DRAIN,
        ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
      };
      const res = await this.runMatchPasses(sig, passOpts);
      matches += res.matches;
      passes += res.passes;
    }
    return { matches, passes, partitions: sigs.length };
  }

  /**
   * Removes abandoned waiters older than `maxWaitSeconds` IN ONE
   * partition. No-op when `maxWaitSeconds` was not configured. Safe to
   * call on every request; the SQL function throttles by
   * `sweepIntervalMs` server-side per partition.
   */
  async sweepExpired(partitionSignature: string): Promise<SweepExpiredResult> {
    assertPartitionSignature(partitionSignature, 'Matchmaker.sweepExpired');
    if (this.maxWaitSeconds === undefined) return { removed: 0 };
    await this.assertSchemaMatches();
    const nowParam = this.nowParam();
    const result = await this.sqlClient.query<{
      matchmaking_sweep_expired: number | string;
    }>(
      `SELECT matchmaking_sweep_expired($1, $2, $3, $4) AS matchmaking_sweep_expired`,
      [partitionSignature, this.maxWaitSeconds, this.sweepIntervalMs, nowParam]
    );
    const raw = result.rows[0]?.matchmaking_sweep_expired ?? 0;
    const removed = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw;
    return { removed };
  }

  /**
   * Fan-out sweep across every currently-active partition. Same shape as
   * `runMatchPassesAcrossPartitions`. Used by admin tooling and tests.
   */
  async sweepExpiredAcrossPartitions(
    opts: SweepExpiredAcrossPartitionsOptions = {}
  ): Promise<SweepExpiredAcrossPartitionsResult> {
    if (this.maxWaitSeconds === undefined) {
      return { removed: 0, partitions: 0 };
    }
    const sigs = await this.discoverActivePartitions(opts.maxPartitions);
    let removed = 0;
    for (const sig of sigs) {
      const res = await this.sweepExpired(sig);
      removed += res.removed;
    }
    return { removed, partitions: sigs.length };
  }

  /**
   * Global cleanup of matched rows older than `matchedRetentionSeconds`.
   * No partition argument — matched rows are dropped from the hot waiting
   * index already, so one global pass is cheap and well-coalesced by its
   * own throttle row. Safe to call on every request.
   */
  async sweepMatched(): Promise<SweepMatchedResult> {
    if (this.matchedRetentionSeconds <= 0) return { removed: 0 };
    await this.assertSchemaMatches();
    const nowParam = this.nowParam();
    const result = await this.sqlClient.query<{
      matchmaking_sweep_matched: number | string;
    }>(
      `SELECT matchmaking_sweep_matched($1, $2, $3) AS matchmaking_sweep_matched`,
      [this.matchedRetentionSeconds, this.sweepIntervalMs, nowParam]
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
      `SELECT DISTINCT partition_signature
       FROM matchmaking_queue
       WHERE status = 'waiting'
       LIMIT $1`,
      [cap]
    );
    return result.rows.map((r) => r.partition_signature);
  }

  // Lazy-checked on first pass/sweep so a misconfigured Matchmaker
  // (different `partitionKeys` than `migrate()` was called with) blows up
  // loudly on first use instead of silently producing zero matches.
  private async assertSchemaMatches(): Promise<void> {
    if (this.fingerprintChecked) return;
    const result = await this.sqlClient.query<{ schema_fingerprint: string }>(
      `SELECT schema_fingerprint FROM matchmaking_schema_state WHERE id = 1`
    );
    const actual = result.rows[0]?.schema_fingerprint ?? null;
    assert.ok(
      actual === this.expectedFingerprint,
      'Matchmaker: schema fingerprint mismatch — did migrate() see different options?',
      { expected: this.expectedFingerprint, actual }
    );
    this.fingerprintChecked = true;
  }

  private nowParam(): string | null {
    if (this.clock === undefined) return null;
    return new Date(this.clock()).toISOString();
  }
}
