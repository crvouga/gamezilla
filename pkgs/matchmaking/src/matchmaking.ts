/**
 * Public, high-level entry point for `@pkgs/matchmaking`.
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
 * for HTTP clients live at `@pkgs/matchmaking/wire`; SQL client
 * adapters live at `@pkgs/matchmaking/storage`. Nothing else
 * escapes the package.
 *
 * Internal helpers use the TypeScript `private` keyword for consistency
 * with the rest of the package (no `#private` fields). Pure construction-
 * time helpers (option resolution, validation, SQL client wiring) live
 * as `private static` methods.
 */

import { assert } from '@pkgs/assert';
import { createLogger } from '@pkgs/logger';
import { Hono, type MiddlewareHandler } from 'hono';
import type { Pool } from 'pg';
import { createMatchmakingApp } from './app';
import { MatchmakingSchemaDriftError } from './errors';
import { Matchmaker, type MatchmakerOptions } from './matchmaker';
import { migrate, type MatchmakingSchema } from './migrate';
import { MATCHMAKING_TICK_ADVISORY_LOCK_ID } from './migrate-sql';
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';
import type {
  DistanceFormula,
  JoinInput,
  JoinResult,
  LeaveResult,
  RadiusOptions,
  StatusResult,
  UpdateFormulasResult,
} from './types';

export { MatchmakingSchemaDriftError } from './errors';
export { MATCHMAKING_PAYLOAD_LIMITS } from './payload-limits';

/**
 * Backing store for a `Matchmaking` instance. Holds a single
 * {@link SqlClient} — the package abstracts over both `pg.Pool` and any
 * embedder-supplied per-request client through that one interface.
 *
 * If you have a `pg.Pool` and want the simplest possible boot, call
 * {@link Matchmaking.fromPool} instead of constructing this shape
 * yourself. Embedders who thread a per-request connection (e.g. a
 * worker that pins one `pg.Client` per database request via
 * `AsyncLocalStorage`) pass their own `SqlClient` here.
 */
export type MatchmakingStorage = {
  readonly sqlClient: SqlClient;
};

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
  private readonly migrateArgs: Parameters<typeof migrate>[0];
  /**
   * Lazily initialised on the first call to {@link ensureBooted}.
   * Held as `Promise | undefined` (not eagerly created at construction)
   * so the `migrate()` SQL calls run inside the same async-context that
   * invoked the first public method.
   *
   * This matters for embedders whose {@link SqlClient} is sourced from
   * a request-scoped `AsyncLocalStorage` (e.g. an embedder threads
   * one `pg.Client` per request). Construction happens during
   * Worker boot, with no request scope live; firing `migrate()` from
   * the constructor would fail the SqlClient's scope-required assertion
   * and permanently brick the cached promise. Deferring to the first
   * method call lets the boot run inside a request handler, where the
   * AsyncLocalStorage is populated.
   *
   * Reset to `undefined` on rejection so the next caller gets a fresh
   * attempt — transient migration errors (e.g. a temporary DB outage at
   * Worker cold-start) don't permanently brick the instance.
   */
  private bootPromise: Promise<void> | undefined;

  constructor(opts: MatchmakingOptions) {
    const resolved = Matchmaking.resolveOptions(opts);
    Matchmaking.assertOptions(resolved);
    this.sqlClient = resolved.sqlClient;
    this.schema = resolved.schema;
    this.matchmaker = new Matchmaker(resolved.matchmakerOptions);
    this.migrateArgs = {
      sqlClient: this.sqlClient,
      schema: this.schema,
      ...(resolved.radius !== undefined ? { radius: resolved.radius } : {}),
      ...(resolved.tuning !== undefined
        ? { tuning: Matchmaking.tuningForMigrate(resolved.tuning) }
        : {}),
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

  async leave(participantId: string): Promise<LeaveResult> {
    await this.ensureBooted();
    return this.matchmaker.leave(participantId);
  }

  async status(participantId: string): Promise<StatusResult | null> {
    await this.ensureBooted();
    return this.matchmaker.status(participantId);
  }

  /**
   * Replaces the formulas of a participant who is currently in the
   * waiting queue. Preserves their `joined_at` (no queue-position
   * penalty) and their partition. Returns `{ updated: false }` when
   * the participant is no longer waiting — either already matched,
   * already swept, or never existed. Callers typically treat that as
   * a 404 / "you missed it" on the request layer.
   *
   * Use this to widen criteria during a long wait without rejoining
   * (which would lose FIFO position). Validation is identical to
   * `join`.
   */
  async updateFormulas(
    participantId: string,
    formulas: readonly DistanceFormula[]
  ): Promise<UpdateFormulasResult> {
    await this.ensureBooted();
    return this.matchmaker.updateFormulas(participantId, formulas);
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
   *
   * Single-flight guard: acquires the SAME `pg_try_advisory_lock` id
   * that the SQL `matchmaking_tick()` uses. When the lock is held
   * (concurrent JS tick, or a concurrent pg_cron call in production)
   * this returns a zero {@link TickResult} immediately — never double-
   * processes a partition. The lock is unlocked in a `finally` so a
   * SQL error mid-drain still releases it.
   */
  async tick(opts?: TickOptions): Promise<TickResult> {
    await this.ensureBooted();
    const acquired = await Matchmaking.tryAdvisoryLock(this.sqlClient);
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
    } finally {
      // Best-effort unlock. If the session is broken (connection
      // already lost) the lock is auto-released by Postgres on the
      // next backend recycle; suppress to keep the tick error visible.
      await Matchmaking.releaseAdvisoryLock(this.sqlClient);
    }
  }

  // ---------------- private instance ----------------

  /**
   * Lazily kick off `migrate()` on the first call, then memoize. If
   * the boot rejects, clear the cache so the next caller retries — a
   * permanently-cached rejection would brick every subsequent
   * request after a transient migration failure (e.g. a momentary DB
   * blip during Worker cold-start). The `.catch(noop)` on the cached
   * promise suppresses the Node "unhandled rejection" warning for
   * the case where no one ever awaits the first call.
   */
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
      schema: opts.schema,
      onSchemaDrift: (expected, actual): never => {
        throw new MatchmakingSchemaDriftError(expected, actual);
      },
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

  /**
   * Single-flight guard for `tick()`. Same advisory lock id the SQL
   * `matchmaking_tick()` function takes — concurrent JS ticks and
   * concurrent cron ticks all serialise through one Postgres-side
   * mutex. Returns false when the lock is already held (caller should
   * return a zero {@link TickResult} immediately).
   *
   * Per Postgres docs, `pg_try_advisory_lock` is session-scoped. The
   * matching `pg_advisory_unlock` MUST run on the same backend. With a
   * pooled client this is guaranteed by binding the lock+unlock pair
   * to the same checked-out client — but our `SqlClient` abstraction
   * doesn't expose a "pin a connection" primitive. In practice:
   *
   *   - the `pg-adapter` uses `Pool.connect()` per `.query()`, which
   *     can land on different backends. The lock would then never be
   *     released on the same backend that took it — Postgres still
   *     auto-releases on backend recycle, but the lock could linger
   *     for the rest of the backend's life.
   *   - a per-request `SqlClient` adapter pins one `pg.Client` for
   *     the whole request, so lock+unlock land on the same backend.
   *   - PGlite uses one in-process connection, so lock+unlock always
   *     land on the same backend.
   *
   * The contract: hosts that drive `tick()` from JS in production
   * SHOULD pin a single client for the whole tick.
   * The SQL `matchmaking_tick()` function takes the same lock from
   * pg_cron's own session, which is naturally pinned per cron worker.
   */
  private static async tryAdvisoryLock(sqlClient: SqlClient): Promise<boolean> {
    const result = await sqlClient.query<{ pg_try_advisory_lock: boolean }>(
      `SELECT pg_try_advisory_lock($1::bigint) AS pg_try_advisory_lock`,
      [MATCHMAKING_TICK_ADVISORY_LOCK_ID]
    );
    return result.rows[0]?.pg_try_advisory_lock === true;
  }

  private static async releaseAdvisoryLock(
    sqlClient: SqlClient
  ): Promise<void> {
    try {
      await sqlClient.query(`SELECT pg_advisory_unlock($1::bigint)`, [
        MATCHMAKING_TICK_ADVISORY_LOCK_ID,
      ]);
    } catch (err) {
      // Backend might have died mid-tick; Postgres auto-releases the
      // lock on backend exit. Logging the unlock failure is enough.
      Matchmaking.log.warn('matchmaking tick: advisory unlock failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private static readonly log = createLogger({ name: 'matchmaking' });

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
    assert.defined(
      storage.sqlClient,
      'Matchmaking: storage.sqlClient is required (use Matchmaking.fromPool for a pg.Pool)'
    );
    return storage.sqlClient;
  }

  /**
   * One-liner factory for the common case: an embedder that already
   * has a `pg.Pool` and just wants a working `Matchmaking`. Wraps the
   * pool in the package's internal {@link SqlClient} adapter — the
   * only place on the public surface where the `pg` import is visible.
   *
   * For per-request connection wiring (e.g. Neon HTTP per request),
   * construct `new Matchmaking(...)`
   * directly and pass your own `SqlClient` via `storage`.
   */
  static fromPool(
    pool: Pool,
    opts: Omit<MatchmakingOptions, 'storage'>
  ): Matchmaking {
    return new Matchmaking({
      ...opts,
      storage: { sqlClient: createPgSqlClient(pool) },
    });
  }
}
