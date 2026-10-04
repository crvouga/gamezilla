/**
 * SQL-backed {@link Matchmaking} adapter (SQLite + Postgres).
 *
 * Construct with `new MatchmakingImplSql({ sqlClient, schema, tuning })`.
 * Boot always runs {@link installPostgresSqliteCompat} (no-op on SQLite)
 * then portable {@link migrate} — callers never declare a dialect.
 */

import { assert } from '@pkgs/assert-shared/singleton';
import { createMatchmakingApp } from '@pkgs/matchmaking-server/app';
import { MatchmakingSchemaDriftError } from '@pkgs/matchmaking-shared/errors';
import type {
  CurrentSearch,
  SearchRequest,
} from '@pkgs/matchmaking-shared/identity';
import type {
  JoinInputRaw,
  Matchmaking,
  MatchmakingAppOptions,
  MatchmakingConfig,
  MatchmakingTuning,
  TickOptions,
  TickResult,
  UpdateFormulasInputRaw,
} from '@pkgs/matchmaking-shared/matchmaking';
import type { MatchmakingSchema } from '@pkgs/matchmaking-shared/schema';
import type {
  DistanceFormula,
  JoinInput,
  JoinResult,
  LeaveResult,
  RadiusOptions,
  StatusResult,
  UpdateFormulasResult,
} from '@pkgs/matchmaking-shared/types';
import type { FormationPorts } from '@pkgs/matchmaking-sql-shared/match-pass';
import type { MatchmakerOptions } from '@pkgs/matchmaking-sql-shared/matchmaker';
import { Matchmaker } from '@pkgs/matchmaking-sql-shared/matchmaker';
import { migrate } from '@pkgs/matchmaking-sql-shared/migrate';
import { Hono } from 'hono';

export type MatchmakingImplSqlOptions = MatchmakingConfig & {
  readonly sqlClient: import('@pkgs/sql-client-shared/interface').SqlClient;
  readonly onFormed?: FormationPorts['onFormed'];
  readonly restrictionsFor?: FormationPorts['restrictionsFor'];
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

  async leave(input: SearchRequest): Promise<LeaveResult> {
    await this.ensureBooted();
    return this.matchmaker.leave(input);
  }

  async status(
    ownerId: string,
    participantId: string
  ): Promise<StatusResult | null> {
    await this.ensureBooted();
    return this.matchmaker.status(ownerId, participantId);
  }

  async updateFormulas(
    input: SearchRequest,
    formulas: readonly DistanceFormula[]
  ): Promise<UpdateFormulasResult> {
    await this.ensureBooted();
    return this.matchmaker.updateFormulas(input, formulas);
  }

  async updateFormulasRaw(
    input: SearchRequest,
    change: UpdateFormulasInputRaw
  ): Promise<UpdateFormulasResult> {
    await this.ensureBooted();
    return this.matchmaker.updateFormulasRaw(input, change);
  }

  async current(ownerId: string): Promise<CurrentSearch | null> {
    await this.ensureBooted();
    return this.matchmaker.current(ownerId);
  }

  async setAvailable(ownerId: string, available: boolean): Promise<void> {
    await this.ensureBooted();
    return this.matchmaker.setAvailable(ownerId, available);
  }

  async setRestriction(
    ownerA: string,
    ownerB: string,
    restricted: boolean
  ): Promise<void> {
    await this.ensureBooted();
    return this.matchmaker.setRestriction(ownerA, ownerB, restricted);
  }

  app(opts: MatchmakingAppOptions): Hono {
    const inner = createMatchmakingApp({
      matchmaking: this,
      requireAuth: opts.requireAuth,
      ownerId: opts.ownerId,
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

  async canPair(ownerA: string, ownerB: string): Promise<boolean> {
    await this.ensureBooted();
    return this.matchmaker.canPair(ownerA, ownerB);
  }

  async tick(opts?: TickOptions): Promise<TickResult> {
    await this.ensureBooted();
    // Pool and owner rows coordinate concurrent replicas in the shared database.
    const drained = await this.matchmaker.runMatchPassesAcrossPartitions(
      MatchmakingImplSql.buildFanOpts(opts)
    );
    return {
      matches: drained.matches,
      passes: drained.passes,
      partitions: drained.partitions,
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
      ...(opts.onFormed === undefined ? {} : { onFormed: opts.onFormed }),
      ...(opts.restrictionsFor === undefined
        ? {}
        : { restrictionsFor: opts.restrictionsFor }),
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

  private static spreadTuning(
    tuning: MatchmakingTuning
  ): Partial<MatchmakerOptions> {
    return {
      ...(tuning.maxPairsPerPass !== undefined
        ? { maxPairsPerPass: tuning.maxPairsPerPass }
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
