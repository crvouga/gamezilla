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
 * is internal to `@pkgs/matchmaking` and not part of the public
 * API. The package's `exports` map and the root `tsconfig.json` paths
 * deliberately make this file unreachable from outside the package; do
 * not change either map without considering the abstraction contract.
 * Consumers go through `Matchmaking` (the public facade in
 * `matchmaking.ts`).
 *
 * @internal
 */

import { assert } from '@pkgs/assert';
import type { AttributeState } from '@pkgs/attribute';
import { asKeywordRecord, assertKeywordRecord } from '@pkgs/keyword';
import { honey, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  assertDataMatchesFormula,
  type FormulaWire,
  serializeFormula,
} from './formula-wire';
import {
  assertDistanceFormulasInput,
  assertWireFormulasInput,
  resolveGroupSize,
  resolveJoinAttrs,
  type InsertJoinAttrs,
} from './join-helpers';
import {
  assertMatchmakerOptionInvariants,
  assertPartitionSignature,
  rowToParticipant,
  type ActivePartition,
  type MatchPassRow,
  type ParticipantRow,
  type RunMatchPassesAcrossPartitionsOptions,
  type RunMatchPassesAcrossPartitionsResult,
  type RunMatchPassesOptions,
  type RunMatchPassesResult,
  type StatusRow,
  type SweepExpiredAcrossPartitionsOptions,
  type SweepExpiredAcrossPartitionsResult,
  type SweepExpiredResult,
  type SweepMatchedResult,
  type UpdateFormulasInputRaw,
} from './matchmaker-internals';
import { fingerprintForOptions, type MatchmakingSchema } from './migrate';
import { MATCHMAKING_MIN_GROUP_SIZE } from './migrate-sql';
import { parallelMap } from './parallel-map';
import {
  DEFAULT_RADIUS_OPTIONS,
  type DistanceFormula,
  type JoinInput,
  type JoinResult,
  type LeaveResult,
  type _MatchPassResult,
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

export { MAX_FORMULAS_PER_PARTICIPANT } from './join-helpers';

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
  readonly sqlClient: SqlClient;
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

export type JoinInputRaw = {
  readonly data: AttributeState;
  readonly formulas: readonly FormulaWire[];
  readonly groupSize?: number;
  readonly priority?: number;
  readonly metadata?: Record<string, unknown> | null;
};

export type {
  ActivePartition,
  RunMatchPassesAcrossPartitionsOptions,
  RunMatchPassesAcrossPartitionsResult,
  RunMatchPassesOptions,
  RunMatchPassesResult,
  SweepExpiredAcrossPartitionsOptions,
  SweepExpiredAcrossPartitionsResult,
  SweepExpiredResult,
  SweepMatchedResult,
  UpdateFormulasInputRaw,
} from './matchmaker-internals';

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
    this.sqlClient = opts.sqlClient;
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
    assertMatchmakerOptionInvariants({
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
    assertDistanceFormulasInput(input.formulas, 'Matchmaker.join');
    for (let i = 0; i < input.formulas.length; i += 1) {
      const formula = input.formulas[i];
      assert.defined(
        formula,
        `Matchmaker.join: formulas[${String(i)}] required`
      );
      assertDataMatchesFormula(
        input.data,
        formula,
        `Matchmaker.join: formulas[${String(i)}]`
      );
    }
    const attrs = resolveJoinAttrs(input, 'Matchmaker.join');

    await this.assertSchemaFingerprint();
    const wire = input.formulas.map(serializeFormula);
    return this.insertJoin(input.data, wire, attrs);
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
    assertWireFormulasInput(input.formulas, 'Matchmaker.joinRaw');
    const attrs = resolveJoinAttrs(input, 'Matchmaker.joinRaw');
    await this.assertSchemaFingerprint();
    return this.insertJoin(input.data, input.formulas, attrs);
  }

  private async insertJoin(
    data: AttributeState,
    formulas: readonly FormulaWire[],
    attrs: InsertJoinAttrs
  ): Promise<JoinResult> {
    // Single CTE: INSERT into waiting + UPSERT into active_partitions in
    // one round-trip. The active_partitions row is observed by the
    // tick fan-out so the (signature, group_size) pair wakes up on
    // the next tick.
    const signature = this.partitionSignatureFor(data);
    const metadata =
      attrs.metadata === null ? null : JSON.stringify(attrs.metadata);
    const rows = await this.sqlClient.query<{ id: string }>(
      honey({
        with: [
          [
            'ins',
            {
              insertInto: 'matchmaking_waiting',
              values: {
                data: ['cast', JSON.stringify(data), 'jsonb'],
                formulas: ['cast', JSON.stringify(formulas), 'jsonb'],
                partition_signature: signature,
                group_size: attrs.groupSize,
                priority: attrs.priority,
                metadata: ['cast', metadata, 'jsonb'],
              },
              returning: ['id'],
            },
          ],
          [
            'reg',
            {
              insertInto: 'matchmaking_active_partitions',
              values: {
                partition_signature: signature,
                group_size: attrs.groupSize,
              },
              onConflict: {
                target: ['partition_signature', 'group_size'],
                doNothing: true,
              },
              returning: ['partition_signature'],
            },
          ],
        ],
        select: ['id'],
        from: 'ins',
      })
    );
    const row = rows[0];
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
    assertDistanceFormulasInput(formulas, 'Matchmaker.updateFormulas');
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
    assertWireFormulasInput(input.formulas, 'Matchmaker.updateFormulasRaw');
    return this.updateFormulasInner(participantId, input.formulas);
  }

  private async updateFormulasInner(
    participantId: string,
    formulas: readonly FormulaWire[]
  ): Promise<UpdateFormulasResult> {
    const rows = await this.sqlClient.query<{ id: string }>(
      honey({
        update: 'matchmaking_waiting',
        set: { formulas: ['cast', JSON.stringify(formulas), 'jsonb'] },
        where: ['=', 'id', participantId],
        returning: ['id'],
      })
    );
    return { updated: rows.length > 0 };
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
    const rows = await this.sqlClient.query<{ id: string }>(
      honey({
        deleteFrom: 'matchmaking_waiting',
        where: ['=', 'id', participantId],
        returning: ['id'],
      })
    );
    return { removed: rows.length > 0 };
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
    // honey: UNION ALL with a trailing LIMIT that binds to the whole
    // compound — honey compound queries don't take a trailing LIMIT, and
    // wrapping in a subquery would change the plan.
    const rows = await this.sqlClient.query<StatusRow>(sql`
      SELECT 'waiting'::TEXT AS status, data, metadata, NULL::UUID AS match_id
       FROM matchmaking_waiting WHERE id = ${participantId}
       UNION ALL
       SELECT 'matched'::TEXT AS status, data, metadata, match_id
       FROM matchmaking_matched WHERE id = ${participantId}
       LIMIT 1`);
    const row = rows[0];
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
      honey({
        select: ['id', 'joined_at', 'data', 'metadata'],
        from: 'matchmaking_matched',
        where: [
          'and',
          ['=', 'match_id', row.match_id],
          ['<>', 'id', participantId],
        ],
        orderBy: ['joined_at'],
      })
    );
    return {
      status: 'matched',
      data,
      metadata: row.metadata ?? null,
      matchId: row.match_id,
      peers: peers.map(rowToParticipant),
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
    // honey: set-returning function in FROM position (no honey grammar for a
    // table-valued function call).
    const rows = await this.sqlClient.query<MatchPassRow>(sql`
      SELECT match_id, participant_id, joined_at, data
       FROM matchmaking_run_match_pass(${partitionSignature}, ${this.radius.baseRadius}, ${this.radius.radiusGrowthPerSecond}, ${this.radius.maxRadius}, ${this.maxPairsPerPass}, ${this.bucketWidth}, ${resolvedGroupSize}, ${nowParam})`);
    const matchIds = new Set<string>();
    for (const r of rows) matchIds.add(r.match_id);
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
    // honey: DELETE target table alias (`ap`) + correlated NOT EXISTS.
    await this.sqlClient.run(sql`
      DELETE FROM matchmaking_active_partitions ap
       WHERE NOT EXISTS (
         SELECT 1 FROM matchmaking_waiting w
         WHERE w.partition_signature = ap.partition_signature
           AND w.group_size = ap.group_size
       )`);
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
    const rows = await this.sqlClient.query<{
      matchmaking_sweep_expired: number | string;
    }>(
      // honey: custom SQL function call (not in honey's function allowlist).
      sql`SELECT matchmaking_sweep_expired(${partitionSignature}, ${this.maxWaitSeconds}, ${nowParam}) AS matchmaking_sweep_expired`
    );
    const raw = rows[0]?.matchmaking_sweep_expired ?? 0;
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
    const rows = await this.sqlClient.query<{
      matchmaking_sweep_matched: number | string;
    }>(
      // honey: custom SQL function call (not in honey's function allowlist).
      sql`SELECT matchmaking_sweep_matched(${this.matchedRetentionSeconds}, ${nowParam}) AS matchmaking_sweep_matched`
    );
    const raw = rows[0]?.matchmaking_sweep_matched ?? 0;
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
    const rows = await this.sqlClient.query<{ schema_fingerprint: string }>(
      honey({
        select: ['schema_fingerprint'],
        from: 'matchmaking_schema_state',
        where: ['=', 'id', 1],
      })
    );
    // Missing row means `migrate()` never ran for this DB; treat the
    // same as drift. The public facade always migrates as part of
    // construction so this is only reachable when someone bypasses
    // `Matchmaking` entirely.
    const actual = rows[0]?.schema_fingerprint ?? '<not migrated>';
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
    const rows = await this.sqlClient.query<{
      partition_signature: string;
      group_size: number | string;
    }>(
      honey({
        select: ['partition_signature', 'group_size'],
        from: 'matchmaking_active_partitions',
        orderBy: ['first_seen_at'],
        limit: cap,
      })
    );
    return rows.map((r) => ({
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
