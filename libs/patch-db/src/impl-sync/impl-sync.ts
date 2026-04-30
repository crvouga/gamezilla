import { assert } from '@gamezilla/lib/assert';
import { fireAndForget } from '@gamezilla/lib/async/fire-and-forget';
import { createLogger, type Logger } from '@gamezilla/lib/logger';
import type { PubSub, Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type {
  Patch,
  PatchesDb,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';

const PATCHES_DB_TOPIC = 'patches-db';

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

function collectMissingSyncedIds(
  knownPatches: readonly Patch[],
  serverPatchIds: ReadonlySet<string>,
  patchIdsToUnsync: Set<string>
): void {
  for (const localPatch of knownPatches) {
    const syncedAt = localPatch.attributes['patch/syncedAt'];
    const isSynced = syncedAt !== null && syncedAt !== undefined;
    if (isSynced && !serverPatchIds.has(localPatch.patchId)) {
      patchIdsToUnsync.add(localPatch.patchId);
    }
  }
}

export type SyncErrorEvent = {
  source: 'push' | 'poll';
  error: unknown;
};

/** Handle returned by {@link SyncPatchesDbScheduler.scheduleInterval}. */
export type SyncPatchesDbScheduleHandle = {
  cancel: () => void;
};

/**
 * Injectable interval scheduler (default uses `setInterval`).
 * Use in tests with a deterministic scheduler.
 */
export type SyncPatchesDbScheduler = {
  scheduleInterval(
    intervalMs: number,
    callback: () => void
  ): SyncPatchesDbScheduleHandle;
};

export const defaultSyncPatchesDbScheduler: SyncPatchesDbScheduler = {
  scheduleInterval(intervalMs, callback) {
    const id = setInterval(callback, intervalMs);
    return {
      cancel: () => clearInterval(id),
    };
  },
};

export type SyncPatchesDbOptions = {
  pushIntervalMs?: number;
  pollIntervalMs?: number;
  /**
   * `interval` (default): repeat {@link SyncPatchesDb.runPushNow} on a timer.
   * `manual`: no timer; call {@link SyncPatchesDb.runPushNow} explicitly (tests / simulation).
   */
  pushDriver?: 'interval' | 'manual';
  /**
   * `interval` (default): repeat {@link SyncPatchesDb.runPollNow} on a timer.
   * `manual`: no timer; call {@link SyncPatchesDb.runPollNow} explicitly (tests / simulation).
   */
  pollDriver?: 'interval' | 'manual';
  /** Scheduler for push and poll timers (default: real-time `setInterval`). */
  scheduler?: SyncPatchesDbScheduler;
  /**
   * When false, failed push/poll cycles are not logged to stderr (failures still increment counters and may publish {@link SYNC_ERROR_TOPIC}).
   * Default true. Deterministic sim tests set this to false to avoid expected-failure noise.
   */
  logPushPollFailures?: boolean;
  /** Structured logger for push/poll diagnostics. Falls back to a default logger if omitted. */
  logger?: Logger;
};

type ActiveQuery = {
  query: PatchesDbQuery;
  refCount: number;
};

const defaultLog = createLogger({ name: 'patch-db:sync' });

export class SyncPatchesDb implements PatchesDb {
  get hooks() {
    return this.local.hooks;
  }

  get compaction() {
    return this.local.compaction;
  }

  private readonly log: Logger;
  private readonly logPushPollFailures: boolean;
  /** Stops subscription callbacks after {@link destroy} (e.g. HMR / teardown races). */
  private destroyed = false;

  subscribe = {
    patches: (
      query: PatchesDbQuery,
      listener: (result: PatchesDbResult) => void
    ): Unsubscribe => this.registerAndSubscribe(query, 'patches', listener),
    entities: (
      query: PatchesDbQuery,
      listener: (result: PatchesDbResult) => void
    ): Unsubscribe => this.registerAndSubscribe(query, 'entities', listener),
  };

  private activeQueries = new Map<string, ActiveQuery>();
  private pushScheduleHandle: SyncPatchesDbScheduleHandle | null = null;
  private pollScheduleHandle: SyncPatchesDbScheduleHandle | null = null;
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
    private local: PatchesDb,
    private remote: PatchesDb,
    private pubSub: PubSub,
    private options: SyncPatchesDbOptions
  ) {
    this.log = options.logger ?? defaultLog;
    this.logPushPollFailures = options.logPushPollFailures !== false;
    this.ensurePushTimer();
  }

  /**
   * Runs a single push cycle (read unsynced locals -> remote.write -> local.update synced flags).
   * Use with {@link SyncPatchesDbOptions.pushDriver} `"manual"` or to force an extra push.
   */
  async runPushNow(): Promise<void> {
    await this.pushUnsynced();
  }

  /**
   * Runs a single poll cycle (merge remote patches for active subscription queries).
   * Use with {@link SyncPatchesDbOptions.pollDriver} `"manual"` or to force an extra poll.
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
    if (this.pushScheduleHandle !== null && this.pushScheduleHandle !== undefined) {
      this.pushScheduleHandle.cancel();
      this.pushScheduleHandle = null;
    }
    if (this.pollScheduleHandle !== null && this.pollScheduleHandle !== undefined) {
      this.pollScheduleHandle.cancel();
      this.pollScheduleHandle = null;
    }
  }

  async write(
    patches: PatchInput[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
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
    queries: PatchesDbQuery[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchesDbResult[]> {
    return this.local.read(queries, ctx);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    return this.local.update(updates, ctx);
  }

  private queryKey(query: PatchesDbQuery): string {
    return JSON.stringify(query);
  }

  private registerAndSubscribe(
    query: PatchesDbQuery,
    _mode: 'patches' | 'entities',
    listener: (result: PatchesDbResult) => void
  ): Unsubscribe {
    const key = this.queryKey(query);
    const existing = this.activeQueries.get(key);
    if (existing) {
      existing.refCount++;
    } else {
      this.activeQueries.set(key, { query, refCount: 1 });
      this.ensurePollTimer();
    }

    const notify = async () => {
      if (this.destroyed) return;
      const [result] = await this.local.read([query], OPEN_PATCHES_DB_CONTEXT);
      if (this.destroyed) return;
      assert.ok(
        result !== null && result !== undefined,
        'read([query]) must return one result'
      );
      listener(result);
    };
    fireAndForget(notify(), {
      component: 'SyncPatchesDb',
      op: 'notify',
      queryKey: key,
    });

    const unsub = this.pubSub.subscribe(PATCHES_DB_TOPIC, () => {
      fireAndForget(notify(), {
        component: 'SyncPatchesDb',
        op: 'notify-invalidation',
        queryKey: key,
      });
    });

    return () => {
      unsub();
      const entry = this.activeQueries.get(key);
      if (entry) {
        entry.refCount--;
        if (entry.refCount <= 0) {
          this.activeQueries.delete(key);
          this.maybeStopPollTimer();
        }
      }
    };
  }

  private ensurePollTimer(): void {
    if (this.pollScheduleHandle !== null && this.pollScheduleHandle !== undefined)
      return;
    const pollDriver = this.options.pollDriver ?? 'interval';
    if (pollDriver === 'manual') return;
    const pollIntervalMs = this.options.pollIntervalMs ?? 5000;
    const scheduler = this.options.scheduler ?? defaultSyncPatchesDbScheduler;
    this.pollScheduleHandle = scheduler.scheduleInterval(pollIntervalMs, () => {
      fireAndForget(this.poll(), {
        component: 'SyncPatchesDb',
        op: 'poll-interval',
      });
    });
    fireAndForget(this.poll(), {
      component: 'SyncPatchesDb',
      op: 'poll-initial',
    });
  }

  private maybeStopPollTimer(): void {
    if (
      this.activeQueries.size === 0 &&
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
    const scheduler = this.options.scheduler ?? defaultSyncPatchesDbScheduler;
    this.pushScheduleHandle = scheduler.scheduleInterval(pushIntervalMs, () => {
      fireAndForget(this.pushUnsynced(), {
        component: 'SyncPatchesDb',
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

  private async markRemotePushSucceeded(patches: readonly Patch[]): Promise<void> {
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
    await this.poll();
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

  private async pushUnsynced(): Promise<void> {
    if (this.destroyed) return;
    try {
      const [result] = await this.local.read(
        [
          {
            on: 'patches',
            where: {
              type: 'not_exists',
              attribute: 'patch/syncedAt',
            },
          },
        ],
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
      await this.remote.write(patches, OPEN_PATCHES_DB_CONTEXT);
      await this.markRemotePushSucceeded(patches);
    } catch (err) {
      this.logPushFailure(err);
      this.publishPushFatalIfNeeded(err);
      await this.tryRecoverFromParentFkPushError(err);
    }
  }

  private async buildSyncQueries(
    entries: ActiveQuery[]
  ): Promise<PatchesDbQuery[]> {
    const syncQueries: PatchesDbQuery[] = [];
    for (const { query } of entries) {
      const { limit, offset, ...queryWithoutPagination } = query;
      const [localResult] = await this.local.read(
        [queryWithoutPagination],
        OPEN_PATCHES_DB_CONTEXT
      );
      assert.ok(
        localResult !== null && localResult !== undefined,
        'read([query]) must return one result'
      );
      syncQueries.push({
        ...queryWithoutPagination,
        knownPatches: localResult.patches,
      });

      if (
        query.where !== null &&
        query.where !== undefined &&
        query.entityType !== null &&
        query.entityType !== undefined
      ) {
        const entityIds = [
          ...new Set(localResult.patches.map((p) => p.entityId)),
        ];
        if (entityIds.length > 0) {
          const [trackedResult] = await this.local.read(
            [{ entityType: query.entityType, entityId: entityIds }],
            OPEN_PATCHES_DB_CONTEXT
          );
          assert.ok(
            trackedResult !== null && trackedResult !== undefined,
            'read([query]) must return one result'
          );
          syncQueries.push({
            entityType: query.entityType,
            entityId: entityIds,
            knownPatches: trackedResult.patches,
          });
        }
      }
    }
    return syncQueries;
  }

  private async mergeRemotePatches(
    results: PatchesDbResult[]
  ): Promise<boolean> {
    let hasNewPatches = false;
    for (const remoteResult of results) {
      if (remoteResult.patches.length > 0) {
        const withSynced = remoteResult.patches.map((p) => ({
          ...p,
          attributes: { ...p.attributes, 'patch/syncedAt': '1' },
        }));
        await this.local.write(withSynced, OPEN_PATCHES_DB_CONTEXT);
        hasNewPatches = true;
      }
    }
    return hasNewPatches;
  }

  /**
   * Detects server data loss by comparing the server's response against locally
   * synced patches. For each query without a `where` clause (entity-tracking
   * queries), if the server is missing patches the client had already pushed,
   * those patches are marked unsynced so the next push cycle re-sends them.
   *
   * Only checks queries without `where` to avoid false positives caused by
   * snapshot-level filtering differences between client and server.
   */
  private async markMissingSyncedPatches(
    queries: PatchesDbQuery[],
    results: PatchesDbResult[]
  ): Promise<boolean> {
    const patchIdsToUnsync = new Set<string>();

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const result = results[i];
      if (!query?.knownPatches || !result) continue;
      if (query.where) continue;

      const serverPatchIds = new Set(result.patches.map((p) => p.patchId));
      collectMissingSyncedIds(
        query.knownPatches,
        serverPatchIds,
        patchIdsToUnsync
      );
    }

    if (patchIdsToUnsync.size === 0) return false;

    await this.local.update(
      [...patchIdsToUnsync].map((patchId) => ({
        patchId,
        attributes: { 'patch/syncedAt': null },
      })),
      OPEN_PATCHES_DB_CONTEXT
    );
    return true;
  }

  /**
   * Builds lightweight wire queries from full sync queries by replacing
   * full Patch objects with just their IDs. The server only needs IDs
   * to know what the client already has.
   */
  private static toWireQueries(syncQueries: PatchesDbQuery[]): PatchesDbQuery[] {
    return syncQueries.map(({ knownPatches, ...rest }) => ({
      ...rest,
      knownPatchIds: knownPatches?.map((p) => p.patchId) ?? [],
    }));
  }

  private async poll(): Promise<void> {
    if (this.destroyed) return;
    const entries = Array.from(this.activeQueries.values());
    if (entries.length === 0) return;
    if (this.pollInProgress) return;

    this.pollInProgress = true;
    try {
      const syncQueries = await this.buildSyncQueries(entries);
      const wireQueries = SyncPatchesDb.toWireQueries(syncQueries);
      const results = await this.remote.read(
        wireQueries,
        OPEN_PATCHES_DB_CONTEXT
      );
      const recoveredPatches = await this.markMissingSyncedPatches(
        syncQueries,
        results
      );
      const hasNewPatches = await this.mergeRemotePatches(results);
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
