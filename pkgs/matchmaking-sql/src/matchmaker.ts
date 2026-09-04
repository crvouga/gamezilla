/**
 * SQL-backed matchmaking engine: portable CRUD + app-layer match passes.
 *
 * @internal
 */

import { assert } from '@pkgs/assert';
import type { AttributeState } from '@pkgs/attribute';
import { asKeywordRecord, assertKeywordRecord } from '@pkgs/keyword';
import {
  type _MatchPassResult,
  assertDataMatchesFormula,
  assertDistanceFormulasInput,
  assertWireFormulasInput,
  type DistanceFormula,
  type FormulaWire,
  type InsertJoinAttrs,
  type JoinInput,
  type JoinInputRaw,
  type JoinResult,
  type LeaveResult,
  MATCHMAKING_MIN_GROUP_SIZE,
  type RadiusOptions,
  resolveGroupSize,
  resolveJoinAttrs,
  type StatusResult,
  serializeFormula,
  type UpdateFormulasResult,
} from '@pkgs/matchmaking/interface';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { runClaimedMatchPass } from './match-pass';
import {
  partitionSignatureFor,
  primaryBucket,
  primaryRating,
  resolveGlobalRadius,
} from './matching';
import {
  type ActivePartition,
  assertMatchmakerOptionInvariants,
  assertPartitionSignature,
  epochMs,
  parseJsonObject,
  parseJsonValue,
  type RunMatchPassesAcrossPartitionsOptions,
  type RunMatchPassesAcrossPartitionsResult,
  type RunMatchPassesOptions,
  type RunMatchPassesResult,
  rowToParticipant,
  type SweepExpiredAcrossPartitionsOptions,
  type SweepExpiredAcrossPartitionsResult,
  type SweepExpiredResult,
  type SweepMatchedResult,
  type UpdateFormulasInputRaw,
} from './matchmaker-internals';
import {
  activePartitionsQuery,
  prunePartitionsQuery,
  releaseStaleClaimsQuery,
  schemaFingerprintQuery,
  statusLookupQuery,
  statusPeersQuery,
  sweepExpiredWaitingQuery,
  sweepMatchedRowsQuery,
} from './matchmaker-queries';
import { fingerprintForOptions, type MatchmakingSchema } from './migrate';
import { parallelMap } from './parallel-map';
import { activePartitionId } from './schema/tables';

export type { FormulaWire } from '@pkgs/matchmaking/interface';
export { MAX_FORMULAS_PER_PARTICIPANT } from '@pkgs/matchmaking/interface';
export type { JoinInputRaw };

const DEFAULT_MAX_PAIRS_PER_PASS = 500;
const DEFAULT_BUCKET_WIDTH = 50;
const DEFAULT_MAX_PASSES_DRAIN = 8;
const DEFAULT_MAX_PARTITIONS_FANOUT = 1024;
const DEFAULT_MATCHED_RETENTION_SECONDS = 3600;
const DEFAULT_DRAIN_CONCURRENCY = 1;
const DEFAULT_CLAIM_TTL_MS = 30_000;

export type MatchmakerOptions = {
  readonly sqlClient: SqlClient;
  readonly radius?: RadiusOptions;
  readonly now: () => number;
  readonly createId: () => string;
  readonly maxPairsPerPass?: number;
  readonly maxWaitSeconds?: number;
  readonly partitionKeys?: readonly string[];
  readonly bucketWidth?: number;
  readonly matchedRetentionSeconds?: number;
  /** Stale claim release window. Default 30s. */
  readonly claimTtlMs?: number;
  readonly schema?: MatchmakingSchema;
  readonly onSchemaDrift?: (expected: string, actual: string) => never;
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
};

export class Matchmaker {
  private readonly sqlClient: SqlClient;
  private readonly radius: RadiusOptions;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly maxPairsPerPass: number;
  private readonly maxWaitSeconds: number | undefined;
  private readonly matchedRetentionSeconds: number;
  private readonly claimTtlMs: number;
  private readonly partitionKeys: readonly string[];
  private readonly bucketWidth: number;
  private readonly schema: MatchmakingSchema | undefined;
  private readonly onSchemaDrift:
    | ((expected: string, actual: string) => never)
    | undefined;
  private schemaChecked = false;

  constructor(opts: MatchmakerOptions) {
    assert.defined(opts, 'Matchmaker: options required');
    assert.defined(opts.sqlClient, 'Matchmaker: sqlClient required');
    assert.ok(typeof opts.now === 'function', 'Matchmaker: now required');
    assert.ok(
      typeof opts.createId === 'function',
      'Matchmaker: createId required'
    );
    this.sqlClient = opts.sqlClient;
    this.radius = resolveGlobalRadius(opts.radius);
    this.now = opts.now;
    this.createId = opts.createId;
    this.maxPairsPerPass = opts.maxPairsPerPass ?? DEFAULT_MAX_PAIRS_PER_PASS;
    this.maxWaitSeconds = opts.maxWaitSeconds;
    this.matchedRetentionSeconds =
      opts.matchedRetentionSeconds ?? DEFAULT_MATCHED_RETENTION_SECONDS;
    this.claimTtlMs = opts.claimTtlMs ?? DEFAULT_CLAIM_TTL_MS;
    this.partitionKeys = opts.partitionKeys ?? [];
    this.bucketWidth = opts.bucketWidth ?? DEFAULT_BUCKET_WIDTH;
    this.schema = opts.schema;
    this.onSchemaDrift = opts.onSchemaDrift;
    assertMatchmakerOptionInvariants({
      maxPairsPerPass: this.maxPairsPerPass,
      bucketWidth: this.bucketWidth,
      matchedRetentionSeconds: this.matchedRetentionSeconds,
      claimTtlMs: this.claimTtlMs,
    });
  }

  partitionSignatureFor(data: AttributeState): string {
    return partitionSignatureFor(data, this.partitionKeys);
  }

  private async assertSchemaFingerprint(): Promise<void> {
    if (this.schemaChecked || this.schema === undefined) return;
    this.schemaChecked = true;
    const expected = fingerprintForOptions(this.schema);
    const rows = await this.sqlClient.query(schemaFingerprintQuery());
    const actual = rows[0]?.schema_fingerprint;
    if (actual === undefined || actual !== expected) {
      const drift = this.onSchemaDrift;
      if (drift !== undefined) {
        drift(expected, actual ?? '<missing>');
      }
      throw new Error(
        `matchmaking schema drift: expected ${expected}, got ${actual ?? '<missing>'}`
      );
    }
  }

  async join(input: JoinInput): Promise<JoinResult> {
    assert.defined(input, 'Matchmaker.join: input required');
    await this.assertSchemaFingerprint();
    assert.record(input.data, 'Matchmaker.join: data must be an object');
    assertKeywordRecord(assert, input.data, 'Matchmaker.join: data');
    assertDistanceFormulasInput(input.formulas, 'Matchmaker.join');
    for (let i = 0; i < input.formulas.length; i += 1) {
      const formula = input.formulas[i];
      assert.defined(formula, `Matchmaker.join: formulas[${String(i)}]`);
      assertDataMatchesFormula(
        input.data,
        formula,
        `Matchmaker.join: formulas[${String(i)}]`
      );
    }
    const attrs = resolveJoinAttrs(input, 'Matchmaker.join');
    return this.insertJoin(
      input.data,
      input.formulas.map(serializeFormula),
      attrs
    );
  }

  async joinRaw(input: JoinInputRaw): Promise<JoinResult> {
    assert.defined(input, 'Matchmaker.joinRaw: input required');
    await this.assertSchemaFingerprint();
    assert.record(input.data, 'Matchmaker.joinRaw: data must be an object');
    assertKeywordRecord(assert, input.data, 'Matchmaker.joinRaw: data');
    assertWireFormulasInput(input.formulas, 'Matchmaker.joinRaw');
    const attrs = resolveJoinAttrs(input, 'Matchmaker.joinRaw');
    return this.insertJoin(input.data, input.formulas, attrs);
  }

  private async insertJoin(
    data: AttributeState,
    formulas: readonly FormulaWire[],
    attrs: InsertJoinAttrs
  ): Promise<JoinResult> {
    const signature = this.partitionSignatureFor(data);
    const metadata =
      attrs.metadata === null ? null : JSON.stringify(attrs.metadata);
    const participantId = this.createId();
    const joinedAt = this.now();
    const nowIso = new Date(joinedAt).toISOString();
    const rating = primaryRating(data, this.schema?.primaryNumericKey);
    const bucket = primaryBucket(rating, this.bucketWidth);
    const partitionId = activePartitionId(signature, attrs.groupSize);
    await this.sqlClient.transaction(async (tx) => {
      await tx.run(
        sql<void>`
          INSERT INTO matchmaking_waiting (
            id, joined_at, data, formulas, partition_signature,
            group_size, priority, metadata, primary_rating, primary_bucket,
            created_at, updated_at, deleted_at
          )
          VALUES (
            ${participantId},
            ${joinedAt},
            ${JSON.stringify(data)},
            ${JSON.stringify(formulas)},
            ${signature},
            ${attrs.groupSize},
            ${attrs.priority},
            ${metadata},
            ${rating},
            ${bucket},
            ${nowIso},
            ${nowIso},
            ${null}
          )`
      );
      await tx.run(
        sql<void>`
          INSERT INTO matchmaking_active_partitions (
            id, partition_signature, group_size, first_seen_at,
            created_at, updated_at, deleted_at
          )
          VALUES (
            ${partitionId},
            ${signature},
            ${attrs.groupSize},
            ${joinedAt},
            ${nowIso},
            ${nowIso},
            ${null}
          )
          ON CONFLICT (partition_signature, group_size) DO UPDATE SET
            deleted_at = NULL,
            updated_at = excluded.updated_at`
      );
    });
    return { participantId };
  }

  async updateFormulas(
    participantId: string,
    formulas: readonly DistanceFormula[]
  ): Promise<UpdateFormulasResult> {
    assert.nonEmptyString(
      participantId,
      'Matchmaker.updateFormulas: participantId must be a non-empty string'
    );
    assertDistanceFormulasInput(formulas, 'Matchmaker.updateFormulas');
    return this.updateFormulasInner(
      participantId,
      formulas.map(serializeFormula)
    );
  }

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
    const nowIso = new Date(this.now()).toISOString();
    const rows = await this.sqlClient.query(
      sql<{ id: string }>`
        UPDATE matchmaking_waiting
           SET formulas = ${JSON.stringify(formulas)},
               updated_at = ${nowIso}
         WHERE id = ${participantId}
           AND deleted_at IS NULL
        RETURNING id`
    );
    return { updated: rows.length > 0 };
  }

  async leave(participantId: string): Promise<LeaveResult> {
    assert.nonEmptyString(
      participantId,
      'Matchmaker.leave: participantId must be a non-empty string'
    );
    const nowIso = new Date(this.now()).toISOString();
    const rows = await this.sqlClient.query(
      sql<{ id: string }>`
        UPDATE matchmaking_waiting
           SET deleted_at = ${nowIso},
               updated_at = ${nowIso}
         WHERE id = ${participantId}
           AND deleted_at IS NULL
        RETURNING id`
    );
    return { removed: rows.length > 0 };
  }

  async status(participantId: string): Promise<StatusResult | null> {
    assert.nonEmptyString(
      participantId,
      'Matchmaker.status: participantId must be a non-empty string'
    );
    const rows = await this.sqlClient.query(statusLookupQuery(participantId));
    const row = rows[0];
    if (row === undefined) return null;
    const data = asKeywordRecord(
      parseJsonObject(row.data, 'matchmaking status data'),
      'matchmaking status data'
    );
    const metadataRaw = parseJsonValue(row.metadata);
    const metadata =
      metadataRaw === null || metadataRaw === undefined
        ? null
        : (metadataRaw as Record<string, unknown>);
    if (row.status === 'waiting') {
      return { status: 'waiting', data, metadata };
    }
    if (row.match_id === null) {
      throw new Error(
        `matchmaking row ${participantId} is matched but has no match_id`
      );
    }
    const peers = await this.sqlClient.query(
      statusPeersQuery(row.match_id, participantId)
    );
    return {
      status: 'matched',
      data,
      metadata,
      matchId: row.match_id,
      peers: peers.map(rowToParticipant),
    };
  }

  async runMatchPass(
    partitionSignature: string,
    groupSize: number = MATCHMAKING_MIN_GROUP_SIZE
  ): Promise<_MatchPassResult> {
    assertPartitionSignature(partitionSignature, 'Matchmaker.runMatchPass');
    const resolvedGroupSize = resolveGroupSize(
      groupSize,
      'Matchmaker.runMatchPass'
    );
    const matches = await runClaimedMatchPass({
      sqlClient: this.sqlClient,
      partitionSignature,
      groupSize: resolvedGroupSize,
      maxPairsPerPass: this.maxPairsPerPass,
      bucketWidth: this.bucketWidth,
      radius: this.radius,
      claimTtlMs: this.claimTtlMs,
      nowMs: this.now(),
      createId: this.createId,
    });
    return { matches };
  }

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

  async runMatchPassesAcrossPartitions(
    opts: RunMatchPassesAcrossPartitionsOptions = {}
  ): Promise<RunMatchPassesAcrossPartitionsResult> {
    const pairs = await this.discoverActivePartitions(opts.maxPartitions);
    const concurrency = opts.concurrency ?? DEFAULT_DRAIN_CONCURRENCY;
    const results = await parallelMap(
      pairs,
      concurrency,
      async (pair) => {
        const passOpts: RunMatchPassesOptions = {
          groupSize: pair.groupSize,
          ...(opts.maxPassesPerPartition !== undefined
            ? { maxPasses: opts.maxPassesPerPartition }
            : {}),
          ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
        };
        return this.runMatchPasses(pair.partitionSignature, passOpts);
      },
      opts.signal
    );
    let matches = 0;
    let passes = 0;
    for (const r of results) {
      if (r === undefined) continue;
      matches += r.matches;
      passes += r.passes;
    }
    await this.sqlClient.run(
      prunePartitionsQuery(new Date(this.now()).toISOString())
    );
    return { matches, passes, partitions: pairs.length };
  }

  async sweepExpired(partitionSignature: string): Promise<SweepExpiredResult> {
    assertPartitionSignature(partitionSignature, 'Matchmaker.sweepExpired');
    if (this.maxWaitSeconds === undefined || this.maxWaitSeconds <= 0) {
      return { removed: 0 };
    }
    const nowMs = this.now();
    const cutoffMs = nowMs - this.maxWaitSeconds * 1000;
    const result = await this.sqlClient.run(
      sweepExpiredWaitingQuery({
        partitionSignature,
        cutoffMs,
        nowIso: new Date(nowMs).toISOString(),
      })
    );
    return { removed: result.changes };
  }

  async sweepExpiredAcrossPartitions(
    opts: SweepExpiredAcrossPartitionsOptions = {}
  ): Promise<SweepExpiredAcrossPartitionsResult> {
    const pairs = await this.discoverActivePartitions(opts.maxPartitions);
    const concurrency = opts.concurrency ?? DEFAULT_DRAIN_CONCURRENCY;
    const results = await parallelMap(pairs, concurrency, async (pair) =>
      this.sweepExpired(pair.partitionSignature)
    );
    let removed = 0;
    for (const r of results) {
      if (r === undefined) continue;
      removed += r.removed;
    }
    return { removed, partitions: pairs.length };
  }

  async sweepMatched(): Promise<SweepMatchedResult> {
    if (this.matchedRetentionSeconds <= 0) return { removed: 0 };
    const nowMs = this.now();
    const cutoffMs = nowMs - this.matchedRetentionSeconds * 1000;
    const result = await this.sqlClient.run(
      sweepMatchedRowsQuery({
        cutoffMs,
        nowIso: new Date(nowMs).toISOString(),
      })
    );
    return { removed: result.changes };
  }

  async releaseStaleClaims(): Promise<void> {
    const nowMs = this.now();
    await this.sqlClient.run(
      releaseStaleClaimsQuery({
        nowMs,
        nowIso: new Date(nowMs).toISOString(),
        claimTtlMs: this.claimTtlMs,
      })
    );
  }

  private async discoverActivePartitions(
    maxPartitions: number | undefined
  ): Promise<ActivePartition[]> {
    const cap = maxPartitions ?? DEFAULT_MAX_PARTITIONS_FANOUT;
    const rows = await this.sqlClient.query(activePartitionsQuery(cap));
    return rows.map((r) => ({
      partitionSignature: r.partition_signature,
      groupSize: epochMs(r.group_size),
    }));
  }
}
