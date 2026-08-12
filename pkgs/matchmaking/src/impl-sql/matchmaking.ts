/**
 * Postgres-backed {@link Matchmaking} adapter.
 *
 * Construct with `new MatchmakingImplSql({ sqlClient, schema, tuning, radius? })`.
 * Embedders never plumb a separate migration step — `ready()` / first
 * public method runs `migrate()` once via a cached boot promise.
 */

import { assert } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import { createMatchmakingApp } from '../interface/app';
import { MatchmakingSchemaDriftError } from '../interface/errors';
import type {
  JoinInputRaw,
  Matchmaking,
  MatchmakingAppOptions,
  MatchmakingConfig,
  MatchmakingTuning,
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
  RadiusOptions,
  StatusResult,
  UpdateFormulasResult,
} from '../interface/types';
import { Matchmaker, type MatchmakerOptions } from './matchmaker';
import { migrate } from './migrate';
import { MATCHMAKING_TICK_ADVISORY_LOCK_ID } from './migrate-sql';

export type MatchmakingImplSqlOptions = MatchmakingConfig & {
  readonly sqlClient: SqlClient;
};

type ResolvedOptions = {
  readonly sqlClient: SqlClient;
  readonly schema: MatchmakingSchema;
  readonly partitionKeys: readonly string[];
  readonly matchmakerOptions: MatchmakerOptions;
  readonly radius: RadiusOptions | undefined;
  readonly tuning: MatchmakingTuning;
};

export class MatchmakingImplSql implements Matchmaking {
  private readonly sqlClient: SqlClient;
  private readonly schema: MatchmakingSchema;
  private readonly matchmaker: Matchmaker;
  private readonly migrateArgs: Parameters<typeof migrate>[0];
  private readonly now: () => number;
  private readonly log: ReturnType<typeof createLogger>;
  private bootPromise: Promise<void> | undefined;

  constructor(opts: MatchmakingImplSqlOptions) {
    const resolved = MatchmakingImplSql.resolveOptions(opts);
    MatchmakingImplSql.assertOptions(resolved);
    this.sqlClient = resolved.sqlClient;
    this.schema = resolved.schema;
    this.matchmaker = new Matchmaker(resolved.matchmakerOptions);
    this.now = resolved.tuning.now;
    this.log = createLogger({ name: 'matchmaking', now: this.now });
    this.migrateArgs = {
      sqlClient: this.sqlClient,
      schema: this.schema,
      ...(resolved.radius !== undefined ? { radius: resolved.radius } : {}),
      tuning: MatchmakingImplSql.tuningForMigrate(resolved.tuning),
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
    const acquired = await MatchmakingImplSql.tryAdvisoryLock(this.sqlClient);
    if (!acquired) {
      return {
        matches: 0,
        passes: 0,
        partitions: 0,
        expiredRemoved: 0,
        matchedRemoved: 0,
      };
    }
    try {
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
    } finally {
      await this.releaseAdvisoryLock();
    }
  }

  private async ensureBooted(): Promise<void> {
    if (this.bootPromise === undefined) {
      const p = migrate(this.migrateArgs);
      this.bootPromise = p;
      p.catch((): void => {
        if (this.bootPromise === p) {
          this.bootPromise = undefined;
        }
      });
    }
    await this.bootPromise;
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

  private static async tryAdvisoryLock(sqlClient: SqlClient): Promise<boolean> {
    const rows = await sqlClient.query(
      sql<{ pg_try_advisory_lock: boolean }>`
        SELECT pg_try_advisory_lock(
          ${MATCHMAKING_TICK_ADVISORY_LOCK_ID}::bigint
        ) AS pg_try_advisory_lock`
    );
    return rows[0]?.pg_try_advisory_lock === true;
  }

  private async releaseAdvisoryLock(): Promise<void> {
    try {
      await this.sqlClient.run(
        sql<void>`
          SELECT pg_advisory_unlock(
            ${MATCHMAKING_TICK_ADVISORY_LOCK_ID}::bigint
          )`
      );
    } catch (err) {
      this.log.warn('matchmaking tick: advisory unlock failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
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
