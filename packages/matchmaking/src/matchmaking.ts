/**
 * Public, high-level entry point for `@gamezilla/matchmaking`.
 *
 * `new Matchmaking({ storage, schema, radius?, tuning? })` is the only
 * boot path embedders need. The class:
 *   - Owns the internal `Matchmaker` (queue + pass + sweep operations).
 *   - Owns the bundled `migrate()` call via a cached `bootPromise` so
 *     every public method is "just await it" — embedders never plumb a
 *     separate migration step.
 *   - Exposes `app({ requireAuth })` which mounts the Hono sub-app whose
 *     `/join`, `/leave`, and `/status` routes are each a single SQL
 *     statement with no opportunistic work.
 *   - Exposes `tick()` as the JS driver of pass + sweep operations.
 *     In production, `pg_cron` calls the equivalent SQL function
 *     (`matchmaking_tick()`) every few seconds; the JS `tick()` stays as
 *     the test entry point and a manual escape hatch.
 *     One call drains every active partition + sweeps both expired
 *     waiters and matched rows.
 *
 * The public surface is intentionally six methods on one class:
 * `join`, `leave`, `status`, `app`, `ready`, `tick`. Wire-format types
 * for HTTP clients live at `@gamezilla/matchmaking/wire`; SQL client
 * adapters live at `@gamezilla/matchmaking/storage`. Nothing else
 * escapes the package.
 *
 * Internal helpers use the TypeScript `private` keyword for consistency
 * with the rest of the package (no `#private` fields). Pure construction-
 * time helpers (option resolution, validation, SQL client wiring) live
 * as `private static` methods.
 */

import { assert } from '@gamezilla/lib/assert';
import { Hono, type MiddlewareHandler } from 'hono';
import type { Pool } from 'pg';
import { createMatchmakingApp } from './app';
import { Matchmaker, type MatchmakerOptions } from './matchmaker';
import { migrate, type MatchmakingSchema } from './migrate';
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';
import type {
  JoinInput,
  JoinResult,
  LeaveResult,
  RadiusOptions,
  StatusResult,
} from './types';

export type MatchmakingStorage =
  | { readonly pool: Pool; readonly sqlClient?: never }
  | { readonly sqlClient: SqlClient; readonly pool?: never };

/**
 * Advanced tuning escape hatch. Defaults are correct for the standard
 * `pg_cron`-driven `matchmaking_tick()` deployment; reach for these only
 * when you have a specific reason (tests, simulated clocks, very large
 * queues, custom sweep cadence).
 *
 * These values are baked into the PL/pgSQL `matchmaking_tick()` function
 * at migrate time. Changing tunings after the function is installed
 * requires a re-`migrate()` to re-bake the function body.
 *
 * `minPassIntervalMs` and `sweepIntervalMs` are intentionally absent
 * (v3 schema). The cron scheduler is the sole caller of pass + sweep
 * operations and is self-throttled by its cadence; the SQL-side
 * throttle row + `FOR UPDATE SKIP LOCKED` dance is gone.
 */
export type MatchmakingTuning = {
  readonly maxPairsPerPass?: number;
  readonly maxWaitSeconds?: number;
  readonly matchedRetentionSeconds?: number;
  readonly now?: () => number;
};

export type MatchmakingOptions = {
  readonly storage: MatchmakingStorage;
  readonly schema: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning?: MatchmakingTuning;
};

export type MatchmakingAppOptions = {
  readonly requireAuth: MiddlewareHandler;
};

/**
 * Caps + cancellation knobs for a single {@link Matchmaking.tick} call.
 * Defaults are correct for cron-frequency invocations; reach for these
 * only when a tick has to bound its own runtime explicitly.
 */
export type TickOptions = {
  /** Cap the fan-out scan width when discovering active partitions. */
  readonly maxPartitions?: number;
  /** Cap the per-partition drain loop. */
  readonly maxPassesPerPartition?: number;
  /**
   * Bounded JS-side concurrency for partition drains. Default 8.
   * Postgres serialises same-partition passes via `SKIP LOCKED`, so JS-
   * side concurrency only helps when there are multiple active
   * partitions to drain at once. Set to 1 in tests that want
   * deterministic single-partition ordering.
   */
  readonly concurrency?: number;
  /** Cancellation token, checked between partitions. */
  readonly signal?: AbortSignal;
};

/**
 * Aggregated outcome of a single {@link Matchmaking.tick} call. Safe to
 * log directly as a structured event for observability.
 */
export type TickResult = {
  /** Total pairs produced across every partition. */
  readonly matches: number;
  /** Total `runMatchPass` SQL calls executed across every partition. */
  readonly passes: number;
  /** Partitions visited (bounded by `opts.maxPartitions`). */
  readonly partitions: number;
  /** Abandoned waiters removed by the expiry sweep. */
  readonly expiredRemoved: number;
  /** Aged matched rows removed by the matched-row sweep. */
  readonly matchedRemoved: number;
};

type ResolvedOptions = {
  readonly sqlClient: SqlClient;
  readonly schema: MatchmakingSchema;
  readonly partitionKeys: readonly string[];
  readonly matchmakerOptions: MatchmakerOptions;
  readonly radius: RadiusOptions | undefined;
  readonly tuning: MatchmakingTuning | undefined;
};

export class Matchmaking {
  private readonly sqlClient: SqlClient;
  private readonly schema: MatchmakingSchema;
  private readonly matchmaker: Matchmaker;
  private readonly bootPromise: Promise<void>;

  constructor(opts: MatchmakingOptions) {
    const resolved = Matchmaking.resolveOptions(opts);
    Matchmaking.assertOptions(resolved);
    this.sqlClient = resolved.sqlClient;
    this.schema = resolved.schema;
    this.matchmaker = new Matchmaker(resolved.matchmakerOptions);
    // Run migrate exactly once. Cached so every public method just awaits
    // the same promise; embedders never thread async boot through their
    // wiring code. Awaiters (join/leave/status/app/ready) still surface
    // the migrate error; the silent `.catch(noop)` is purely to prevent
    // a Node "unhandled promise rejection" warning when no one ever
    // touches the instance.
    this.bootPromise = migrate({
      sqlClient: this.sqlClient,
      schema: this.schema,
      ...(resolved.radius !== undefined ? { radius: resolved.radius } : {}),
      ...(resolved.tuning !== undefined
        ? { tuning: Matchmaking.tuningForMigrate(resolved.tuning) }
        : {}),
    });
    this.bootPromise.catch((): void => undefined);
  }

  async ready(): Promise<void> {
    return this.bootPromise;
  }

  async join(input: JoinInput): Promise<JoinResult> {
    await this.ensureBooted();
    return this.matchmaker.join(input);
  }

  async leave(participantId: string): Promise<LeaveResult> {
    await this.ensureBooted();
    return this.matchmaker.leave(participantId);
  }

  async status(participantId: string): Promise<StatusResult | null> {
    await this.ensureBooted();
    return this.matchmaker.status(participantId);
  }

  /**
   * Mounts the matchmaking HTTP routes on a fresh Hono instance behind
   * `opts.requireAuth`. Every route is a pure single-statement read or
   * write — no opportunistic passes, no `waitUntil` background work.
   * Match progress is driven entirely by host-owned scheduling via
   * {@link Matchmaking.tick}. This is the architecture that lets the
   * request envelope scale near-linearly with isolate count instead of
   * multiplying every poll by N SQL roundtrips.
   */
  app(opts: MatchmakingAppOptions): Hono {
    const inner = createMatchmakingApp({
      matchmaker: this.matchmaker,
      requireAuth: opts.requireAuth,
    });
    // Wrap so we can gate every request behind the cached migrate. The
    // inner app already handles routing + validation; we just thread an
    // `await ensureBooted` in front of it.
    const wrapped = new Hono();
    wrapped.use('*', async (_c, next) => {
      await this.ensureBooted();
      await next();
    });
    wrapped.route('/', inner);
    return wrapped;
  }

  /**
   * One-shot, deterministic queue advancement: drains every currently-
   * active partition, sweeps abandoned waiters older than the configured
   * `maxWaitSeconds`, and sweeps matched rows older than
   * `matchedRetentionSeconds`.
   *
   * In production, `pg_cron` calls the equivalent `matchmaking_tick()`
   * SQL function every few seconds (baked by `migrate()` at the same
   * tunings). This JS `tick()` is the canonical test entry point and a
   * useful manual escape hatch when running off a non-pg_cron Postgres
   * (e.g. PGlite in unit tests) or when explicit single-flight control
   * is needed.
   */
  async tick(opts?: TickOptions): Promise<TickResult> {
    await this.ensureBooted();
    const drained = await this.matchmaker.runMatchPassesAcrossPartitions(
      Matchmaking.buildFanOpts(opts)
    );
    const expired = await this.matchmaker.sweepExpiredAcrossPartitions(
      Matchmaking.buildSweepOpts(opts)
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

  // ---------------- private instance ----------------

  private async ensureBooted(): Promise<void> {
    await this.bootPromise;
  }

  // ---------------- private static ----------------

  private static resolveOptions(opts: MatchmakingOptions): ResolvedOptions {
    assert.defined(opts, 'Matchmaking: options required');
    assert.defined(opts.storage, 'Matchmaking: storage required');
    assert.defined(opts.schema, 'Matchmaking: schema required');
    const sqlClient = Matchmaking.resolveSqlClient(opts.storage);
    const partitionKeys = opts.schema.partitionKeys ?? [];
    const matchmakerOptions: MatchmakerOptions = {
      sqlClient,
      partitionKeys,
      ...(opts.schema.bucketWidth !== undefined
        ? { bucketWidth: opts.schema.bucketWidth }
        : {}),
      ...(opts.radius !== undefined ? { radius: opts.radius } : {}),
      ...Matchmaking.spreadTuning(opts.tuning),
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

  /**
   * Translate the public {@link MatchmakingTuning} into the strict
   * subset {@link migrate} bakes into the `matchmaking_tick()` PL/pgSQL
   * function. `now` is JS-only (test clock hook) so it is intentionally
   * dropped — the cron function reads `now()` server-side.
   */
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

  /**
   * Translate a public {@link TickOptions} into the
   * {@link RunMatchPassesAcrossPartitionsOptions} shape the internal
   * matchmaker expects. Centralised so each `tick()` call site stays
   * declaration-light (one statement) and the option-spread complexity
   * lives in one place.
   */
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
    tuning: MatchmakingTuning | undefined
  ): Partial<MatchmakerOptions> {
    if (tuning === undefined) return {};
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
      ...(tuning.now !== undefined ? { now: tuning.now } : {}),
    };
  }

  private static assertOptions(resolved: ResolvedOptions): void {
    // Validation of numeric tunables lives inside `Matchmaker` (so it
    // applies to every Matchmaker, however constructed). Here we only
    // assert what the high-level options layer added on top.
    assert.array(
      resolved.partitionKeys,
      'Matchmaking: schema.partitionKeys must be an array'
    );
    for (const k of resolved.partitionKeys) {
      assert.nonEmptyString(
        k,
        'Matchmaking: schema.partitionKeys entries must be non-empty strings'
      );
    }
  }

  private static resolveSqlClient(storage: MatchmakingStorage): SqlClient {
    if ('sqlClient' in storage && storage.sqlClient !== undefined) {
      return storage.sqlClient;
    }
    if ('pool' in storage && storage.pool !== undefined) {
      return createPgSqlClient(storage.pool);
    }
    throw new Error(
      'Matchmaking: storage must provide either `pool` or `sqlClient`'
    );
  }
}
