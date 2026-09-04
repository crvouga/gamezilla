/**
 * SQL-backed {@link Matchmaking} adapter (SQLite + Postgres).
 *
 * Construct with `new MatchmakingImplSql({ sqlClient, schema, tuning })`.
 * Boot always runs {@link installPostgresSqliteCompat} (no-op on SQLite)
 * then portable {@link migrate} — callers never declare a dialect.
 */

import { assert } from '@pkgs/assert';
import {
  createMatchmakingApp,
  type DistanceFormula,
  type JoinInput,
  type JoinInputRaw,
  type JoinResult,
  type LeaveResult,
  type Matchmaking,
  type MatchmakingAppOptions,
  type MatchmakingConfig,
  type MatchmakingSchema,
  MatchmakingSchemaDriftError,
  type MatchmakingTuning,
  type RadiusOptions,
  type StatusResult,
  type TickOptions,
  type TickResult,
  type UpdateFormulasInputRaw,
  type UpdateFormulasResult,
} from '@pkgs/matchmaking/interface';
import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat';
import { getUnderlyingSqlClient } from '@pkgs/sql-client/impl-agnostic';
import { Hono } from 'hono';
import { Matchmaker, type MatchmakerOptions } from './matchmaker';
import { migrate } from './migrate';

export type MatchmakingImplSqlOptions = MatchmakingConfig & {
  readonly sqlClient: import('@pkgs/sql-client/interface').SqlClient;
};

type ResolvedOptions = {
  readonly sqlClient: MatchmakingImplSqlOptions['sqlClient'];
  readonly schema: MatchmakingSchema;
  readonly partitionKeys: readonly string[];
  readonly matchmakerOptions: MatchmakerOptions;
  readonly radius: RadiusOptions | undefined;
  readonly tuning: MatchmakingTuning;
};

export class MatchmakingImplSql implements Matchmaking {
  private readonly sqlClient: MatchmakingImplSqlOptions['sqlClient'];
  private readonly schema: MatchmakingSchema;
  private readonly matchmaker: Matchmaker;
  private readonly migrateArgs: Parameters<typeof migrate>[0];
  private readonly now: () => number;
  private bootPromise: Promise<void> | undefined;

  constructor(opts: MatchmakingImplSqlOptions) {
    const resolved = MatchmakingImplSql.resolveOptions(opts);
    MatchmakingImplSql.assertOptions(resolved);
    this.sqlClient = resolved.sqlClient;
    this.schema = resolved.schema;
    this.matchmaker = new Matchmaker(resolved.matchmakerOptions);
    this.now = resolved.tuning.now;
    this.migrateArgs = {
      sqlClient: this.sqlClient,
      schema: this.schema,
      ...(resolved.radius !== undefined ? { radius: resolved.radius } : {}),
      tuning: MatchmakingImplSql.tuningForMigrate(resolved.tuning),
      now: this.now,
    };
    this.bootPromise = undefined;
  }

  async ready(): Promise<void> {
    return this.ensureBooted();
  }

  async join(input: JoinInput): Promise<JoinResult> {
    await this.ensureBooted();
    return this.matchmaker.join(input);
  }

  async joinRaw(input: JoinInputRaw): Promise<JoinResult> {
    await this.ensureBooted();
    return this.matchmaker.joinRaw(input);
  }

  async leave(participantId: string): Promise<LeaveResult> {
    await this.ensureBooted();
    return this.matchmaker.leave(participantId);
  }

  async status(participantId: string): Promise<StatusResult | null> {
    await this.ensureBooted();
    return this.matchmaker.status(participantId);
  }

  async updateFormulas(
    participantId: string,
    formulas: readonly DistanceFormula[]
  ): Promise<UpdateFormulasResult> {
    await this.ensureBooted();
    return this.matchmaker.updateFormulas(participantId, formulas);
  }

  async updateFormulasRaw(
    participantId: string,
    input: UpdateFormulasInputRaw
  ): Promise<UpdateFormulasResult> {
    await this.ensureBooted();
    return this.matchmaker.updateFormulasRaw(participantId, input);
  }

  app(opts: MatchmakingAppOptions): Hono {
    const inner = createMatchmakingApp({
      matchmaking: this,
      requireAuth: opts.requireAuth,
      now: this.now,
    });
    const wrapped = new Hono();
    wrapped.use('*', async (_c, next) => {
      await this.ensureBooted();
      await next();
    });
    wrapped.route('/', inner);
    return wrapped;
  }

  async tick(opts?: TickOptions): Promise<TickResult> {
    await this.ensureBooted();
    // Correctness is row-claim based — concurrent ticks are safe. No
    // process-local or advisory lock; workers stay horizontally scalable.
    await this.matchmaker.releaseStaleClaims();
    const drained = await this.matchmaker.runMatchPassesAcrossPartitions(
      MatchmakingImplSql.buildFanOpts(opts)
    );
    const expired = await this.matchmaker.sweepExpiredAcrossPartitions(
      MatchmakingImplSql.buildSweepOpts(opts)
    );
    const matched = await this.matchmaker.sweepMatched();
    return {
      matches: drained.matches,
      passes: drained.passes,
      partitions: drained.partitions,
      expiredRemoved: expired.removed,
      matchedRemoved: matched.removed,
    };
  }

  private async ensureBooted(): Promise<void> {
    if (this.bootPromise === undefined) {
      const p = this.boot();
      this.bootPromise = p;
      p.catch((): void => {
        if (this.bootPromise === p) {
          this.bootPromise = undefined;
        }
      });
    }
    await this.bootPromise;
  }

  private async boot(): Promise<void> {
    // Compat shim DDL is vendor SQL — install on the raw engine client.
    await installPostgresSqliteCompat({
      sqlClient: getUnderlyingSqlClient(this.sqlClient),
    });
    await migrate(this.migrateArgs);
  }

  private static resolveOptions(
    opts: MatchmakingImplSqlOptions
  ): ResolvedOptions {
    assert.defined(opts, 'MatchmakingImplSql: options required');
    assert.defined(opts.sqlClient, 'MatchmakingImplSql: sqlClient required');
    assert.defined(opts.schema, 'MatchmakingImplSql: schema required');
    assert.defined(opts.tuning, 'MatchmakingImplSql: tuning required');
    assert.ok(
      typeof opts.tuning.now === 'function',
      'MatchmakingImplSql: tuning.now required'
    );
    assert.ok(
      typeof opts.tuning.createId === 'function',
      'MatchmakingImplSql: tuning.createId required'
    );
    const sqlClient = opts.sqlClient;
    const partitionKeys = opts.schema.partitionKeys ?? [];
    const matchmakerOptions: MatchmakerOptions = {
      sqlClient,
      partitionKeys,
      schema: opts.schema,
      now: opts.tuning.now,
      createId: opts.tuning.createId,
      onSchemaDrift: (expected, actual): never => {
        throw new MatchmakingSchemaDriftError(expected, actual);
      },
      ...(opts.schema.bucketWidth !== undefined
        ? { bucketWidth: opts.schema.bucketWidth }
        : {}),
      ...(opts.radius !== undefined ? { radius: opts.radius } : {}),
      ...MatchmakingImplSql.spreadTuning(opts.tuning),
    };
    return {
      sqlClient,
      schema: opts.schema,
      partitionKeys,
      matchmakerOptions,
      radius: opts.radius,
      tuning: opts.tuning,
    };
  }

  private static tuningForMigrate(tuning: MatchmakingTuning): {
    readonly maxPairsPerPass?: number;
    readonly maxWaitSeconds?: number;
    readonly matchedRetentionSeconds?: number;
  } {
    return {
      ...(tuning.maxPairsPerPass !== undefined
        ? { maxPairsPerPass: tuning.maxPairsPerPass }
        : {}),
      ...(tuning.maxWaitSeconds !== undefined
        ? { maxWaitSeconds: tuning.maxWaitSeconds }
        : {}),
      ...(tuning.matchedRetentionSeconds !== undefined
        ? { matchedRetentionSeconds: tuning.matchedRetentionSeconds }
        : {}),
    };
  }

  private static buildFanOpts(opts: TickOptions | undefined): {
    readonly maxPartitions?: number;
    readonly maxPassesPerPartition?: number;
    readonly concurrency?: number;
    readonly signal?: AbortSignal;
  } {
    if (opts === undefined) return {};
    return {
      ...(opts.maxPartitions !== undefined
        ? { maxPartitions: opts.maxPartitions }
        : {}),
      ...(opts.maxPassesPerPartition !== undefined
        ? { maxPassesPerPartition: opts.maxPassesPerPartition }
        : {}),
      ...(opts.concurrency !== undefined
        ? { concurrency: opts.concurrency }
        : {}),
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
    };
  }

  private static buildSweepOpts(opts: TickOptions | undefined): {
    readonly maxPartitions?: number;
    readonly concurrency?: number;
  } {
    if (opts === undefined) return {};
    return {
      ...(opts.maxPartitions !== undefined
        ? { maxPartitions: opts.maxPartitions }
        : {}),
      ...(opts.concurrency !== undefined
        ? { concurrency: opts.concurrency }
        : {}),
    };
  }

  private static spreadTuning(
    tuning: MatchmakingTuning
  ): Partial<MatchmakerOptions> {
    return {
      ...(tuning.maxPairsPerPass !== undefined
        ? { maxPairsPerPass: tuning.maxPairsPerPass }
        : {}),
      ...(tuning.maxWaitSeconds !== undefined
        ? { maxWaitSeconds: tuning.maxWaitSeconds }
        : {}),
      ...(tuning.matchedRetentionSeconds !== undefined
        ? { matchedRetentionSeconds: tuning.matchedRetentionSeconds }
        : {}),
    };
  }

  private static assertOptions(resolved: ResolvedOptions): void {
    assert.array(
      resolved.partitionKeys,
      'MatchmakingImplSql: schema.partitionKeys must be an array'
    );
    for (const k of resolved.partitionKeys) {
      assert.nonEmptyString(
        k,
        'MatchmakingImplSql: schema.partitionKeys entries must be non-empty strings'
      );
    }
  }
}
