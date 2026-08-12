/**
 * In-memory {@link Matchmaking} adapter for hermetic contract tests.
 * Implements the same behavioural contract as {@link MatchmakingImplSql}
 * without Postgres / SqlClient.
 */

import { assert } from '@pkgs/assert';
import type { AttributeState } from '@pkgs/attribute';
import { assertKeywordRecord } from '@pkgs/keyword';
import type { Hono } from 'hono';
import { createMatchmakingApp } from '../interface/app';
import {
  assertDataMatchesFormula,
  type FormulaWire,
  serializeFormula,
} from '../interface/formula-wire';
import {
  assertDistanceFormulasInput,
  assertWireFormulasInput,
  resolveJoinAttrs,
} from '../interface/join-helpers';
import type {
  JoinInputRaw,
  Matchmaking,
  MatchmakingAppOptions,
  MatchmakingConfig,
  TickOptions,
  TickResult,
  UpdateFormulasInputRaw,
} from '../interface/matchmaking';
import type { MatchmakingSchema } from '../interface/schema';
import type {
  DistanceFormula,
  JoinInput,
  JoinResult,
  LeaveResult,
  MatchedParticipant,
  RadiusOptions,
  StatusResult,
  UpdateFormulasResult,
} from '../interface/types';
import {
  expandingRadius,
  pairMatch,
  partitionSignatureFor,
  primaryBucket,
  primaryRating,
  resolveGlobalRadius,
} from './matching';

const DEFAULT_MAX_PAIRS_PER_PASS = 500;
const DEFAULT_BUCKET_WIDTH = 50;
const DEFAULT_MAX_PASSES_DRAIN = 8;
const DEFAULT_MAX_PARTITIONS_FANOUT = 1024;
const DEFAULT_MATCHED_RETENTION_SECONDS = 3600;

type WaitingRow = {
  readonly id: string;
  readonly joinedAtMs: number;
  readonly data: AttributeState;
  formulas: readonly FormulaWire[];
  readonly partitionSignature: string;
  readonly groupSize: number;
  readonly priority: number;
  readonly metadata: Record<string, unknown> | null;
  readonly primaryBucket: number;
};

type MatchedRow = {
  readonly id: string;
  readonly joinedAtMs: number;
  readonly matchedAtMs: number;
  readonly matchId: string;
  readonly data: AttributeState;
  readonly metadata: Record<string, unknown> | null;
  readonly peerIds: readonly string[];
};

export type MatchmakingImplInMemoryOptions = MatchmakingConfig;

export class MatchmakingImplInMemory implements Matchmaking {
  private readonly schema: MatchmakingSchema;
  private readonly partitionKeys: readonly string[];
  private readonly radius: RadiusOptions;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly maxPairsPerPass: number;
  private readonly maxWaitSeconds: number | undefined;
  private readonly matchedRetentionSeconds: number;
  private readonly bucketWidth: number;
  private readonly waiting = new Map<string, WaitingRow>();
  private readonly matched = new Map<string, MatchedRow>();
  private tickLocked = false;

  constructor(opts: MatchmakingImplInMemoryOptions) {
    assert.defined(opts, 'MatchmakingImplInMemory: options required');
    assert.defined(opts.schema, 'MatchmakingImplInMemory: schema required');
    assert.defined(opts.tuning, 'MatchmakingImplInMemory: tuning required');
    assert.ok(
      typeof opts.tuning.now === 'function',
      'MatchmakingImplInMemory: tuning.now required'
    );
    assert.ok(
      typeof opts.tuning.createId === 'function',
      'MatchmakingImplInMemory: tuning.createId required'
    );
    this.schema = opts.schema;
    this.partitionKeys = opts.schema.partitionKeys ?? [];
    assert.array(
      this.partitionKeys,
      'MatchmakingImplInMemory: schema.partitionKeys must be an array'
    );
    for (const k of this.partitionKeys) {
      assert.nonEmptyString(
        k,
        'MatchmakingImplInMemory: schema.partitionKeys entries must be non-empty strings'
      );
    }
    this.radius = resolveGlobalRadius(opts.radius);
    this.now = opts.tuning.now;
    this.createId = opts.tuning.createId;
    this.maxPairsPerPass =
      opts.tuning.maxPairsPerPass ?? DEFAULT_MAX_PAIRS_PER_PASS;
    this.maxWaitSeconds = opts.tuning.maxWaitSeconds;
    this.matchedRetentionSeconds =
      opts.tuning.matchedRetentionSeconds ?? DEFAULT_MATCHED_RETENTION_SECONDS;
    this.bucketWidth = opts.schema.bucketWidth ?? DEFAULT_BUCKET_WIDTH;
  }

  async ready(): Promise<void> {
    return;
  }

  async join(input: JoinInput): Promise<JoinResult> {
    assert.defined(input, 'MatchmakingImplInMemory.join: input required');
    assert.record(
      input.data,
      'MatchmakingImplInMemory.join: data must be an object'
    );
    assertKeywordRecord(
      assert,
      input.data,
      'MatchmakingImplInMemory.join: data'
    );
    assertDistanceFormulasInput(input.formulas, 'MatchmakingImplInMemory.join');
    for (let i = 0; i < input.formulas.length; i += 1) {
      const formula = input.formulas[i];
      assert.defined(
        formula,
        `MatchmakingImplInMemory.join: formulas[${String(i)}]`
      );
      assertDataMatchesFormula(
        input.data,
        formula,
        `MatchmakingImplInMemory.join: formulas[${String(i)}]`
      );
    }
    const attrs = resolveJoinAttrs(input, 'MatchmakingImplInMemory.join');
    const wires = input.formulas.map(serializeFormula);
    return this.insertWaiting(input.data, wires, attrs);
  }

  async joinRaw(input: JoinInputRaw): Promise<JoinResult> {
    assert.defined(input, 'MatchmakingImplInMemory.joinRaw: input required');
    assert.record(
      input.data,
      'MatchmakingImplInMemory.joinRaw: data must be an object'
    );
    assertKeywordRecord(
      assert,
      input.data,
      'MatchmakingImplInMemory.joinRaw: data'
    );
    assertWireFormulasInput(input.formulas, 'MatchmakingImplInMemory.joinRaw');
    const attrs = resolveJoinAttrs(input, 'MatchmakingImplInMemory.joinRaw');
    return this.insertWaiting(input.data, input.formulas, attrs);
  }

  async leave(participantId: string): Promise<LeaveResult> {
    assert.nonEmptyString(
      participantId,
      'MatchmakingImplInMemory.leave: participantId must be a non-empty string'
    );
    const removed = this.waiting.delete(participantId);
    return { removed };
  }

  async status(participantId: string): Promise<StatusResult | null> {
    assert.nonEmptyString(
      participantId,
      'MatchmakingImplInMemory.status: participantId must be a non-empty string'
    );
    const waiting = this.waiting.get(participantId);
    if (waiting !== undefined) {
      return {
        status: 'waiting',
        data: waiting.data,
        ...(waiting.metadata !== null ? { metadata: waiting.metadata } : {}),
      };
    }
    const matched = this.matched.get(participantId);
    if (matched === undefined) return null;
    const peers: MatchedParticipant[] = [];
    for (const peerId of matched.peerIds) {
      const peer = this.matched.get(peerId);
      if (peer === undefined) continue;
      peers.push({
        participantId: peer.id,
        joinedAt: new Date(peer.joinedAtMs),
        data: peer.data,
        ...(peer.metadata !== null ? { metadata: peer.metadata } : {}),
      });
    }
    return {
      status: 'matched',
      data: matched.data,
      matchId: matched.matchId,
      peers,
      ...(matched.metadata !== null ? { metadata: matched.metadata } : {}),
    };
  }

  async updateFormulas(
    participantId: string,
    formulas: readonly DistanceFormula[]
  ): Promise<UpdateFormulasResult> {
    assert.nonEmptyString(
      participantId,
      'MatchmakingImplInMemory.updateFormulas: participantId must be a non-empty string'
    );
    assertDistanceFormulasInput(
      formulas,
      'MatchmakingImplInMemory.updateFormulas'
    );
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
      'MatchmakingImplInMemory.updateFormulasRaw: participantId must be a non-empty string'
    );
    assert.defined(
      input,
      'MatchmakingImplInMemory.updateFormulasRaw: input required'
    );
    assertWireFormulasInput(
      input.formulas,
      'MatchmakingImplInMemory.updateFormulasRaw'
    );
    return this.updateFormulasInner(participantId, input.formulas);
  }

  app(opts: MatchmakingAppOptions): Hono {
    return createMatchmakingApp({
      matchmaking: this,
      requireAuth: opts.requireAuth,
      now: this.now,
    });
  }

  async tick(opts?: TickOptions): Promise<TickResult> {
    if (this.tickLocked) {
      return {
        matches: 0,
        passes: 0,
        partitions: 0,
        expiredRemoved: 0,
        matchedRemoved: 0,
      };
    }
    this.tickLocked = true;
    try {
      const pairs = this.discoverActivePartitions(opts?.maxPartitions);
      const maxPasses = opts?.maxPassesPerPartition ?? DEFAULT_MAX_PASSES_DRAIN;
      let matches = 0;
      let passes = 0;
      for (const pair of pairs) {
        if (opts?.signal?.aborted) break;
        for (let i = 0; i < maxPasses; i += 1) {
          if (opts?.signal?.aborted) break;
          const produced = this.runMatchPass(
            pair.partitionSignature,
            pair.groupSize
          );
          passes += 1;
          matches += produced;
          if (produced === 0) break;
        }
      }
      const expiredRemoved = this.sweepExpired();
      const matchedRemoved = this.sweepMatched();
      return {
        matches,
        passes,
        partitions: pairs.length,
        expiredRemoved,
        matchedRemoved,
      };
    } finally {
      this.tickLocked = false;
    }
  }

  private insertWaiting(
    data: AttributeState,
    formulas: readonly FormulaWire[],
    attrs: {
      readonly groupSize: number;
      readonly priority: number;
      readonly metadata: Record<string, unknown> | null;
    }
  ): JoinResult {
    const id = this.createId();
    const rating = primaryRating(data, this.schema.primaryNumericKey);
    const row: WaitingRow = {
      id,
      joinedAtMs: this.now(),
      data,
      formulas,
      partitionSignature: partitionSignatureFor(data, this.partitionKeys),
      groupSize: attrs.groupSize,
      priority: attrs.priority,
      metadata: attrs.metadata,
      primaryBucket: primaryBucket(rating, this.bucketWidth),
    };
    this.waiting.set(id, row);
    return { participantId: id };
  }

  private updateFormulasInner(
    participantId: string,
    formulas: readonly FormulaWire[]
  ): UpdateFormulasResult {
    const row = this.waiting.get(participantId);
    if (row === undefined) return { updated: false };
    row.formulas = formulas;
    return { updated: true };
  }

  private discoverActivePartitions(maxPartitions: number | undefined): {
    readonly partitionSignature: string;
    readonly groupSize: number;
  }[] {
    const cap = maxPartitions ?? DEFAULT_MAX_PARTITIONS_FANOUT;
    const seen = new Map<
      string,
      { partitionSignature: string; groupSize: number }
    >();
    for (const row of this.waiting.values()) {
      const key = `${row.partitionSignature}\0${String(row.groupSize)}`;
      if (!seen.has(key)) {
        seen.set(key, {
          partitionSignature: row.partitionSignature,
          groupSize: row.groupSize,
        });
      }
      if (seen.size >= cap) break;
    }
    return [...seen.values()];
  }

  private snapshotForPass(
    partitionSignature: string,
    groupSize: number
  ): WaitingRow[] {
    return [...this.waiting.values()]
      .filter(
        (r) =>
          r.partitionSignature === partitionSignature &&
          r.groupSize === groupSize
      )
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.joinedAtMs - b.joinedAtMs;
      })
      .slice(0, this.maxPairsPerPass * groupSize * 4);
  }

  private tryBuildGroup(args: {
    readonly snapshot: readonly WaitingRow[];
    readonly seedIndex: number;
    readonly groupSize: number;
    readonly taken: ReadonlySet<string>;
    readonly nowMs: number;
  }): WaitingRow[] | null {
    const { snapshot, seedIndex, groupSize, taken, nowMs } = args;
    const seed = snapshot[seedIndex];
    if (seed === undefined || taken.has(seed.id)) return null;
    const seedRadius = expandingRadius(seed.joinedAtMs, nowMs, this.radius);
    const ring = Math.ceil(seedRadius / Math.max(this.bucketWidth, 1));
    const group: WaitingRow[] = [seed];
    for (let j = seedIndex + 1; j < snapshot.length; j += 1) {
      const cand = snapshot[j];
      if (cand === undefined || taken.has(cand.id)) continue;
      if (Math.abs(seed.primaryBucket - cand.primaryBucket) > ring) continue;
      if (!this.compatibleWithGroup(group, cand, nowMs)) continue;
      group.push(cand);
      if (group.length === groupSize) return group;
    }
    return null;
  }

  private compatibleWithGroup(
    group: readonly WaitingRow[],
    cand: WaitingRow,
    nowMs: number
  ): boolean {
    return group.every((member) =>
      pairMatch({
        a: {
          data: member.data,
          formulas: member.formulas,
          joinedAtMs: member.joinedAtMs,
        },
        b: {
          data: cand.data,
          formulas: cand.formulas,
          joinedAtMs: cand.joinedAtMs,
        },
        nowMs,
        globalRadius: this.radius,
      })
    );
  }

  private claimGroup(
    group: readonly WaitingRow[],
    taken: Set<string>,
    nowMs: number
  ): void {
    const matchId = this.createId();
    const peerIds = group.map((g) => g.id);
    for (const member of group) {
      this.waiting.delete(member.id);
      taken.add(member.id);
      this.matched.set(member.id, {
        id: member.id,
        joinedAtMs: member.joinedAtMs,
        matchedAtMs: nowMs,
        matchId,
        data: member.data,
        metadata: member.metadata,
        peerIds: peerIds.filter((id) => id !== member.id),
      });
    }
  }

  private runMatchPass(partitionSignature: string, groupSize: number): number {
    if (groupSize < 2 || this.maxPairsPerPass <= 0) return 0;
    const nowMs = this.now();
    const snapshot = this.snapshotForPass(partitionSignature, groupSize);
    if (snapshot.length < groupSize) return 0;

    const taken = new Set<string>();
    let claimed = 0;
    for (let i = 0; i <= snapshot.length - groupSize; i += 1) {
      if (claimed >= this.maxPairsPerPass) break;
      const group = this.tryBuildGroup({
        snapshot,
        seedIndex: i,
        groupSize,
        taken,
        nowMs,
      });
      if (group === null) continue;
      this.claimGroup(group, taken, nowMs);
      claimed += 1;
    }
    return claimed;
  }

  private sweepExpired(): number {
    if (this.maxWaitSeconds === undefined || this.maxWaitSeconds <= 0) {
      return 0;
    }
    const cutoff = this.now() - this.maxWaitSeconds * 1000;
    let removed = 0;
    for (const [id, row] of this.waiting) {
      if (row.joinedAtMs < cutoff) {
        this.waiting.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  private sweepMatched(): number {
    if (this.matchedRetentionSeconds <= 0) return 0;
    const cutoff = this.now() - this.matchedRetentionSeconds * 1000;
    let removed = 0;
    for (const [id, row] of this.matched) {
      if (row.matchedAtMs < cutoff) {
        this.matched.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}
