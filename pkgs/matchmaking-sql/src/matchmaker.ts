/**
 * SQL-backed matchmaking engine: portable CRUD + app-layer match passes.
 *
 * @internal
 */

import { assert } from '@pkgs/assert';
import type { AttributeState } from '@pkgs/attribute';
import { assertKeywordRecord } from '@pkgs/keyword';
import {
  type _MatchPassResult,
  assertDataMatchesFormula,
  assertDistanceFormulasInput,
  type CurrentSearch,
  type DistanceFormula,
  type JoinInput,
  type JoinInputRaw,
  type JoinResult,
  type LeaveResult,
  MATCHMAKING_MIN_GROUP_SIZE,
  type RadiusOptions,
  resolveGroupSize,
  type SearchRequest,
  type StatusResult,
  serializeFormula,
  type UpdateFormulasResult,
} from '@pkgs/matchmaking/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { type FormationPorts, runFormation } from './match-pass';
import { partitionSignatureFor, resolveGlobalRadius } from './matching';
import {
  type ActivePartition,
  assertMatchmakerOptionInvariants,
  assertPartitionSignature,
  epochMs,
  type RunMatchPassesAcrossPartitionsOptions,
  type RunMatchPassesAcrossPartitionsResult,
  type RunMatchPassesOptions,
  type RunMatchPassesResult,
  type UpdateFormulasInputRaw,
} from './matchmaker-internals';
import {
  activePartitionsQuery,
  prunePartitionsQuery,
  schemaFingerprintQuery,
} from './matchmaker-queries';
import { fingerprintForOptions, type MatchmakingSchema } from './migrate';
import { changeAvailability, changeRestriction } from './owner-repository';
import { canPair } from './pair-read';
import { parallelMap } from './parallel-map';
import { SearchCommands, type SearchPorts } from './search-commands';
import { readCurrent, readSearch } from './search-read';
import { matchmakingTransaction } from './transaction';

export type { FormulaWire } from '@pkgs/matchmaking/interface';
export { MAX_FORMULAS_PER_PARTICIPANT } from '@pkgs/matchmaking/interface';
export type { JoinInputRaw };

const DEFAULT_MAX_PAIRS_PER_PASS = 500;
const DEFAULT_BUCKET_WIDTH = 50;
const DEFAULT_MAX_PASSES_DRAIN = 8;
const DEFAULT_MAX_PARTITIONS_FANOUT = 1024;
const DEFAULT_DRAIN_CONCURRENCY = 1;

export type MatchmakerOptions = {
  readonly sqlClient: SqlClient;
  readonly radius?: RadiusOptions;
  readonly now: () => number;
  readonly createId: () => string;
  readonly maxPairsPerPass?: number;
  readonly partitionKeys?: readonly string[];
  readonly bucketWidth?: number;
  readonly schema?: MatchmakingSchema;
  readonly onFormed?: FormationPorts['onFormed'];
  readonly restrictionsFor?: FormationPorts['restrictionsFor'];
  readonly onSchemaDrift?: (expected: string, actual: string) => never;
};

export type {
  ActivePartition,
  RunMatchPassesAcrossPartitionsOptions,
  RunMatchPassesAcrossPartitionsResult,
  RunMatchPassesOptions,
  RunMatchPassesResult,
  UpdateFormulasInputRaw,
};

export class Matchmaker {
  private readonly sqlClient: SqlClient;
  private readonly radius: RadiusOptions;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly maxPairsPerPass: number;
  private readonly partitionKeys: readonly string[];
  private readonly bucketWidth: number;
  private readonly onFormed: FormationPorts['onFormed'];
  private readonly restrictionsFor: FormationPorts['restrictionsFor'];
  private readonly schema: MatchmakingSchema | undefined;
  private readonly onSchemaDrift:
    | ((expected: string, actual: string) => never)
    | undefined;

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
    this.partitionKeys = opts.partitionKeys ?? [];
    this.bucketWidth = opts.bucketWidth ?? DEFAULT_BUCKET_WIDTH;
    this.schema = opts.schema;
    this.onFormed = opts.onFormed;
    this.restrictionsFor = opts.restrictionsFor;
    this.onSchemaDrift = opts.onSchemaDrift;
    assertMatchmakerOptionInvariants({
      maxPairsPerPass: this.maxPairsPerPass,
      bucketWidth: this.bucketWidth,
    });
  }

  partitionSignatureFor(data: AttributeState): string {
    return partitionSignatureFor(data, this.partitionKeys);
  }

  private async assertSchemaFingerprint(): Promise<void> {
    if (this.schema === undefined) return;
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
    return this.joinRaw({
      ...input,
      formulas: input.formulas.map(serializeFormula),
    });
  }

  async joinRaw(input: JoinInputRaw): Promise<JoinResult> {
    await this.assertSchemaFingerprint();
    return matchmakingTransaction(this.sqlClient, (tx) =>
      new SearchCommands(tx, this.searchPorts()).begin(input)
    );
  }

  async leave(input: SearchRequest): Promise<LeaveResult> {
    await this.assertSchemaFingerprint();
    return matchmakingTransaction(this.sqlClient, (tx) =>
      new SearchCommands(tx, this.searchPorts()).stop(input)
    );
  }

  async updateFormulas(
    input: SearchRequest,
    formulas: readonly DistanceFormula[]
  ): Promise<UpdateFormulasResult> {
    assertDistanceFormulasInput(formulas, 'Matchmaker.updateFormulas');
    return this.updateFormulasRaw(input, {
      formulas: formulas.map(serializeFormula),
    });
  }

  async updateFormulasRaw(
    input: SearchRequest,
    change: UpdateFormulasInputRaw
  ): Promise<UpdateFormulasResult> {
    await this.assertSchemaFingerprint();
    return matchmakingTransaction(this.sqlClient, (tx) =>
      new SearchCommands(tx, this.searchPorts()).change(input, change)
    );
  }

  async status(
    ownerId: string,
    participantId: string
  ): Promise<StatusResult | null> {
    return matchmakingTransaction(this.sqlClient, (tx) =>
      readSearch(tx, ownerId, participantId)
    );
  }

  async current(ownerId: string): Promise<CurrentSearch | null> {
    return matchmakingTransaction(this.sqlClient, (tx) =>
      readCurrent(tx, ownerId, this.now())
    );
  }

  async setAvailable(ownerId: string, available: boolean): Promise<void> {
    return matchmakingTransaction(this.sqlClient, (tx) =>
      changeAvailability(tx, { ownerId, available, nowMs: this.now() })
    );
  }

  async setRestriction(
    ownerA: string,
    ownerB: string,
    restricted: boolean
  ): Promise<void> {
    return matchmakingTransaction(this.sqlClient, (tx) =>
      changeRestriction(tx, { ownerA, ownerB, restricted, nowMs: this.now() })
    );
  }

  private searchPorts(): SearchPorts {
    return {
      now: this.now,
      schema: this.schema ?? {},
    };
  }

  async canPair(ownerA: string, ownerB: string): Promise<boolean> {
    return matchmakingTransaction(this.sqlClient, (tx) =>
      canPair(tx, {
        ownerA,
        ownerB,
        radius: this.radius,
        nowMs: this.now(),
        restrictionsFor: this.restrictionsFor,
      })
    );
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
    const matches = await runFormation({
      sqlClient: this.sqlClient,
      partitionSignature,
      groupSize: resolvedGroupSize,
      maxPairsPerPass: this.maxPairsPerPass,
      radius: this.radius,
      nowMs: this.now(),
      createId: this.createId,
      ...(this.onFormed === undefined ? {} : { onFormed: this.onFormed }),
      ...(this.restrictionsFor === undefined
        ? {}
        : { restrictionsFor: this.restrictionsFor }),
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
