import { assert } from '@gamezilla/lib/assert';
import { fireAndForget } from '@gamezilla/lib/async/fire-and-forget';
import { createLogger, type Logger } from '@gamezilla/lib/logger';
import type { PubSub, Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type {
  Patch,
  PatchDb,
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import { PatchDbTransportRejectedError } from '../transport/transport-rejected-error';
import { MAX_PATCHES_PER_REQUEST } from '../transport/wire-schemas';
import {
  ActiveQueryRegistry,
  PATCHES_DB_TOPIC,
  singleResultReader,
} from './active-query-registry';
import {
  buildSyncQueriesForPoll,
  markMissingSyncedPatchesOnLocal,
  mergeRemotePatchesIntoLocal,
  toWireQueriesFromSyncQueries,
} from './impl-sync-poll-helpers';
import {
  clearRejectedPushMarkersOnLocal,
  markPatchesRejectedByServer,
  unsyncedPatchesQueryForPush,
} from './impl-sync-rejected-pushes';

/** Topic for sync errors. Subscribe to surface push/poll failures to the UI after consecutive failures. */
export const SYNC_ERROR_TOPIC = 'sync-error';

const MAX_CONSECUTIVE_FAILURES = 5;

/** Postgres constraint name; also see {@link isPatchParentFkViolation}. */
const PATCHES_PARENT_FK_MARKER = 'patches_parent_id_fkey';
/** SQLite (Bun) message when `PRAGMA foreign_keys = ON` and parent row is missing. */
const SQLITE_FK_FAILED_MARKER = 'FOREIGN KEY constraint failed';

function isPatchParentFkViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes(PATCHES_PARENT_FK_MARKER) ||
    msg.includes(SQLITE_FK_FAILED_MARKER)
  );
}

export type SyncErrorEvent = {
  source: 'push' | 'poll';
  error: unknown;
};

/** Handle returned by {@link SyncPatchDbScheduler.scheduleInterval}. */
export type SyncPatchDbScheduleHandle = {
  cancel: () => void;
};

/**
 * Injectable interval scheduler (default uses `setInterval`).
 * Use in tests with a deterministic scheduler.
 */
export type SyncPatchDbScheduler = {
  scheduleInterval(
    intervalMs: number,
    callback: () => void
  ): SyncPatchDbScheduleHandle;
};

export const defaultSyncPatchDbScheduler: SyncPatchDbScheduler = {
  scheduleInterval(intervalMs, callback) {
    const id = setInterval(callback, intervalMs);
    return {
      cancel: () => clearInterval(id),
    };
  },
};

export type SyncPatchDbOptions = {
  pushIntervalMs?: number;
  pollIntervalMs?: number;
  /**
   * `interval` (default): repeat {@link SyncPatchDb.runPushNow} on a timer.
   * `manual`: no timer; call {@link SyncPatchDb.runPushNow} explicitly (tests / simulation).
   */
  pushDriver?: 'interval' | 'manual';
  /**
   * `interval` (default): repeat {@link SyncPatchDb.runPollNow} on a timer.
   * `manual`: no timer; call {@link SyncPatchDb.runPollNow} explicitly (tests / simulation).
   */
  pollDriver?: 'interval' | 'manual';
  /** Scheduler for push and poll timers (default: real-time `setInterval`). */
  scheduler?: SyncPatchDbScheduler;
  /**
   * When false, failed push/poll cycles are not logged to stderr (failures still increment counters and may publish {@link SYNC_ERROR_TOPIC}).
   * Default true. Deterministic sim tests set this to false to avoid expected-failure noise.
   */
  logPushPollFailures?: boolean;
  /** Structured logger for push/poll diagnostics. Falls back to a default logger if omitted. */
  logger?: Logger;
  /**
   * Maximum number of patches sent per `remote.write` call. Defaults to
   * {@link MAX_PATCHES_PER_REQUEST}. Overridable for deterministic tests; in
   * production this MUST stay at or below the wire contract bound — the HTTP
   * client transport will crash if a single request exceeds it.
   */
  maxPushBatchSize?: number;
};

const defaultLog = createLogger({ name: 'patch-db:sync' });

export class SyncPatchDb implements PatchDb {
  get hooks() {
    return this.local.hooks;
  }

  get compaction() {
    return this.local.compaction;
  }

  private readonly log: Logger;
  private readonly logPushPollFailures: boolean;
  private readonly maxPushBatchSize: number;
  /** Stops subscription callbacks after {@link destroy} (e.g. HMR / teardown races). */
  private destroyed = false;

  subscribe = {
    patches: (
      query: PatchDbQuery,
      listener: (result: PatchDbResult) => void
    ): Unsubscribe => this.activeQueries.subscribe(query, listener),
    entities: (
      query: PatchDbQuery,
      listener: (result: PatchDbResult) => void
    ): Unsubscribe => this.activeQueries.subscribe(query, listener),
  };

  private activeQueries: ActiveQueryRegistry;
  private pushScheduleHandle: SyncPatchDbScheduleHandle | null = null;
  private pollScheduleHandle: SyncPatchDbScheduleHandle | null = null;
  private pollInProgress = false;
  private pushConsecutiveFailures = 0;
  private pollConsecutiveFailures = 0;
  /**
   * After we run parent-chain recovery (unsync all locally-synced patches), stay
   * true until the next successful push batch clears it — avoids hammering
   * `unsyncAllLocallySyncedPatches` on every failed tick while still unsynced.
   */
  private parentFkRecoveryInFlight = false;

  constructor(
    private local: PatchDb,
    private remote: PatchDb,
    private pubSub: PubSub,
    private options: SyncPatchDbOptions
  ) {
    this.log = options.logger ?? defaultLog;
    this.logPushPollFailures = options.logPushPollFailures !== false;
    this.maxPushBatchSize = options.maxPushBatchSize ?? MAX_PATCHES_PER_REQUEST;
    assert.ok(
      Number.isSafeInteger(this.maxPushBatchSize) &&
        this.maxPushBatchSize > 0 &&
        this.maxPushBatchSize <= MAX_PATCHES_PER_REQUEST,
      'maxPushBatchSize must be a positive integer not exceeding MAX_PATCHES_PER_REQUEST',
      {
        maxPushBatchSize: this.maxPushBatchSize,
        wireMax: MAX_PATCHES_PER_REQUEST,
      }
    );
    this.activeQueries = new ActiveQueryRegistry({
      read: singleResultReader(this.local),
      pubSub: this.pubSub,
      isDestroyed: () => this.destroyed,
      onFirstSubscriber: () => this.ensurePollTimer(),
      onLastUnsubscribe: () => this.maybeStopPollTimer(),
    });
    this.ensurePushTimer();
  }

  /**
   * Runs a single push cycle (read unsynced locals -> remote.write -> local.update synced flags).
   * Use with {@link SyncPatchDbOptions.pushDriver} `"manual"` or to force an extra push.
   */
  async runPushNow(): Promise<void> {
    await this.pushUnsynced();
  }

  /**
   * Runs a single poll cycle (merge remote patches for active subscription queries).
   * Use with {@link SyncPatchDbOptions.pollDriver} `"manual"` or to force an extra poll.
   */
  async runPollNow(): Promise<void> {
    await this.poll();
  }

  /**
   * Publishes an invalidation so active subscription listeners re-read from the local db.
   * Call after out-of-band mutations (e.g. raw SQL wipes) that bypass {@link write}.
   */
  notifyInvalidated(): void {
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
  }

  /** Stops push and poll timers. Call before disposing of the db. */
  destroy(): void {
    this.destroyed = true;
    if (
      this.pushScheduleHandle !== null &&
      this.pushScheduleHandle !== undefined
    ) {
      this.pushScheduleHandle.cancel();
      this.pushScheduleHandle = null;
    }
    if (
      this.pollScheduleHandle !== null &&
      this.pollScheduleHandle !== undefined
    ) {
      this.pollScheduleHandle.cancel();
      this.pollScheduleHandle = null;
    }
  }

  async write(
    patches: PatchInput[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<Patch[]> {
    const withUnsynced = patches.map((p) => ({
      ...p,
      attributes: { ...p.attributes, 'patch/syncedAt': null },
    }));
    const result = await this.local.write(withUnsynced, ctx);
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    return result;
  }

  read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    return this.local.read(queries, ctx);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.local.update(updates, ctx);
  }

  private ensurePollTimer(): void {
    if (
      this.pollScheduleHandle !== null &&
      this.pollScheduleHandle !== undefined
    )
      return;
    const pollDriver = this.options.pollDriver ?? 'interval';
    if (pollDriver === 'manual') return;
    const pollIntervalMs = this.options.pollIntervalMs ?? 5000;
    const scheduler = this.options.scheduler ?? defaultSyncPatchDbScheduler;
    this.pollScheduleHandle = scheduler.scheduleInterval(pollIntervalMs, () => {
      fireAndForget(this.poll(), {
        component: 'SyncPatchDb',
        op: 'poll-interval',
      });
    });
    fireAndForget(this.poll(), {
      component: 'SyncPatchDb',
      op: 'poll-initial',
    });
  }

  private maybeStopPollTimer(): void {
    if (
      this.activeQueries.size() === 0 &&
      this.pollScheduleHandle !== null &&
      this.pollScheduleHandle !== undefined
    ) {
      this.pollScheduleHandle.cancel();
      this.pollScheduleHandle = null;
    }
  }

  private ensurePushTimer(): void {
    if (
      this.pushScheduleHandle !== null &&
      this.pushScheduleHandle !== undefined
    )
      return;
    const pushDriver = this.options.pushDriver ?? 'interval';
    if (pushDriver === 'manual') return;
    const pushIntervalMs = this.options.pushIntervalMs ?? 2000;
    const scheduler = this.options.scheduler ?? defaultSyncPatchDbScheduler;
    this.pushScheduleHandle = scheduler.scheduleInterval(pushIntervalMs, () => {
      fireAndForget(this.pushUnsynced(), {
        component: 'SyncPatchDb',
        op: 'pushUnsynced',
      });
    });
  }

  private async unsyncAllLocallySyncedPatches(): Promise<void> {
    const [result] = await this.local.read(
      [
        {
          on: 'patches',
          where: { type: 'exists', attribute: 'patch/syncedAt' },
        },
      ],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.ok(
      result !== null && result !== undefined,
      'read([query]) must return one result'
    );
    const synced = result.patches;
    if (synced.length === 0) return;

    await this.local.update(
      synced.map((p) => ({
        patchId: p.patchId,
        attributes: { 'patch/syncedAt': null },
      })),
      OPEN_PATCHES_DB_CONTEXT
    );
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
  }

  private async markChunkPushSucceeded(
    patches: readonly Patch[]
  ): Promise<void> {
    await this.local.update(
      patches.map((p) => ({
        patchId: p.patchId,
        attributes: { 'patch/syncedAt': '1' },
      })),
      OPEN_PATCHES_DB_CONTEXT
    );
    this.pushConsecutiveFailures = 0;
    this.parentFkRecoveryInFlight = false;
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
  }

  /**
   * Clears server-rejected markers on local patches so the next push retries
   * them (e.g. after sign-in when the server would accept).
   */
  async clearRejectedPushes(): Promise<void> {
    await clearRejectedPushMarkersOnLocal(this.local, this.pubSub);
  }

  private logPushFailure(err: unknown): void {
    this.pushConsecutiveFailures += 1;
    if (!this.logPushPollFailures) return;
    this.log.error('push failed', {
      error: err instanceof Error ? err.message : String(err),
      consecutiveFailures: this.pushConsecutiveFailures,
    });
  }

  private publishPushFatalIfNeeded(err: unknown): void {
    if (this.pushConsecutiveFailures < MAX_CONSECUTIVE_FAILURES) return;
    this.pubSub.publish(SYNC_ERROR_TOPIC, {
      source: 'push',
      error: err,
    } satisfies SyncErrorEvent);
  }

  private async tryRecoverFromParentFkPushError(err: unknown): Promise<void> {
    if (!isPatchParentFkViolation(err) || this.parentFkRecoveryInFlight) return;
    this.parentFkRecoveryInFlight = true;
    try {
      this.log.info('recovering from patch chain divergence');
      await this.unsyncAllLocallySyncedPatches();
      this.pushConsecutiveFailures = 0;
    } catch (recoveryErr) {
      this.parentFkRecoveryInFlight = false;
      if (!this.logPushPollFailures) return;
      this.log.error('patch chain recovery failed', {
        error:
          recoveryErr instanceof Error
            ? recoveryErr.message
            : String(recoveryErr),
      });
    }
  }

  /**
   * Pushes `patches` in order in wire-sized chunks; on 401/403 marks the failing
   * chunk rejected and returns without polling.
   */
  private async pushUnsyncedChunksThenPoll(
    patches: readonly Patch[]
  ): Promise<void> {
    const batchSize = this.maxPushBatchSize;
    for (let i = 0; i < patches.length; i += batchSize) {
      if (this.destroyed) return;
      const chunk = patches.slice(i, i + batchSize);
      try {
        await this.remote.write(chunk, OPEN_PATCHES_DB_CONTEXT);
        await this.markChunkPushSucceeded(chunk);
      } catch (chunkErr) {
        if (chunkErr instanceof PatchDbTransportRejectedError) {
          await markPatchesRejectedByServer({
            local: this.local,
            chunk,
            err: chunkErr,
            pubSub: this.pubSub,
            log: this.log,
            logPushPollFailures: this.logPushPollFailures,
          });
          this.pushConsecutiveFailures = 0;
          this.parentFkRecoveryInFlight = false;
          return;
        }
        throw chunkErr;
      }
    }
    await this.poll();
  }

  private async pushUnsynced(): Promise<void> {
    if (this.destroyed) return;
    try {
      const [result] = await this.local.read(
        [unsyncedPatchesQueryForPush()],
        OPEN_PATCHES_DB_CONTEXT
      );
      assert.ok(
        result !== null && result !== undefined,
        'read([query]) must return one result'
      );
      const patches = result.patches;
      if (patches.length === 0) {
        this.pushConsecutiveFailures = 0;
        this.parentFkRecoveryInFlight = false;
        return;
      }
      await this.pushUnsyncedChunksThenPoll(patches);
    } catch (err) {
      this.logPushFailure(err);
      this.publishPushFatalIfNeeded(err);
      await this.tryRecoverFromParentFkPushError(err);
    }
  }

  private async poll(): Promise<void> {
    if (this.destroyed) return;
    const entries = this.activeQueries.values();
    if (entries.length === 0) return;
    if (this.pollInProgress) return;

    this.pollInProgress = true;
    try {
      const syncQueries = await buildSyncQueriesForPoll(this.local, entries);
      const wireQueries = toWireQueriesFromSyncQueries(syncQueries);
      const results = await this.remote.read(
        wireQueries,
        OPEN_PATCHES_DB_CONTEXT
      );
      const recoveredPatches = await markMissingSyncedPatchesOnLocal(
        this.local,
        syncQueries,
        results
      );
      const hasNewPatches = await mergeRemotePatchesIntoLocal(
        this.local,
        results
      );
      this.pollConsecutiveFailures = 0;
      if (hasNewPatches || recoveredPatches) {
        this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
      }
    } catch (err) {
      this.pollConsecutiveFailures += 1;
      if (this.logPushPollFailures) {
        this.log.error('poll failed', {
          error: err instanceof Error ? err.message : String(err),
          consecutiveFailures: this.pollConsecutiveFailures,
        });
      }
      if (this.pollConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.pubSub.publish(SYNC_ERROR_TOPIC, {
          source: 'poll',
          error: err,
        } satisfies SyncErrorEvent);
      }
    } finally {
      this.pollInProgress = false;
    }
  }
}
