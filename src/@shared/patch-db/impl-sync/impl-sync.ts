import { assert } from '../../assert';
import { fireAndForget } from '../../async/fire-and-forget';
import type { PubSub, Unsubscribe } from '../../pub-sub/interface';
import type {
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';

const PATCHES_DB_TOPIC = 'patches-db';

/** Topic for sync errors. Subscribe to surface push/poll failures to the UI after consecutive failures. */
export const SYNC_ERROR_TOPIC = 'sync-error';

const MAX_CONSECUTIVE_FAILURES = 5;

export type SyncErrorEvent = {
  source: 'push' | 'poll';
  error: unknown;
};

export type RemoteInvalidationSource = {
  subscribe(callback: () => void): Unsubscribe;
};

/** Handle returned by {@link SyncPatchesDbPushScheduler.scheduleInterval}. */
export type SyncPatchesDbPushScheduleHandle = {
  cancel: () => void;
};

/**
 * Injectable push interval (default: {@link defaultSyncPatchesDbPushScheduler} uses `setInterval`).
 * Use in tests with a deterministic scheduler.
 */
export type SyncPatchesDbPushScheduler = {
  scheduleInterval(
    intervalMs: number,
    callback: () => void
  ): SyncPatchesDbPushScheduleHandle;
};

export const defaultSyncPatchesDbPushScheduler: SyncPatchesDbPushScheduler = {
  scheduleInterval(intervalMs, callback) {
    const id = setInterval(callback, intervalMs);
    return {
      cancel: () => clearInterval(id),
    };
  },
};

export type SyncPatchesDbOptions = {
  pushIntervalMs?: number;
  remoteInvalidationSource: RemoteInvalidationSource;
  /**
   * `interval` (default): repeat {@link SyncPatchesDb.runPushNow} on a timer.
   * `manual`: no timer; call {@link SyncPatchesDb.runPushNow} explicitly (tests / simulation).
   */
  pushDriver?: 'interval' | 'manual';
  /**
   * `remote-invalidation` (default): poll when the remote invalidation source fires and once when the first query subscription registers.
   * `manual`: call {@link SyncPatchesDb.runPollNow} explicitly (tests / simulation).
   */
  pollDriver?: 'remote-invalidation' | 'manual';
  /** When {@link pushDriver} is `interval`, uses this scheduler (default: real-time `setInterval`). */
  pushScheduler?: SyncPatchesDbPushScheduler;
};

type ActiveQuery = {
  query: PatchesDbQuery;
  refCount: number;
};

export class SyncPatchesDb implements PatchesDb {
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
  private pushScheduleHandle: SyncPatchesDbPushScheduleHandle | null = null;
  private remoteInvalidationUnsub: Unsubscribe | null = null;
  private pollInProgress = false;
  private pushConsecutiveFailures = 0;
  private pollConsecutiveFailures = 0;

  constructor(
    private local: PatchesDb,
    private remote: PatchesDb,
    private pubSub: PubSub,
    private options: SyncPatchesDbOptions
  ) {
    this.ensurePushTimer();
  }

  /**
   * Runs a single push cycle (read unsynced locals → remote.write → local.update synced flags).
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

  /** Stops push scheduling and remote invalidation subscription. Call before disposing of the db. */
  destroy(): void {
    if (this.pushScheduleHandle !== null && this.pushScheduleHandle !== undefined) {
      this.pushScheduleHandle.cancel();
      this.pushScheduleHandle = null;
    }
    if (
      this.remoteInvalidationUnsub !== null &&
      this.remoteInvalidationUnsub !== undefined
    ) {
      this.remoteInvalidationUnsub();
      this.remoteInvalidationUnsub = null;
    }
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    const withUnsynced = patches.map((p) => ({
      ...p,
      attributes: { ...p.attributes, 'patch/syncedAt': null },
    }));
    const result = await this.local.write(withUnsynced);
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    return result;
  }

  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return this.local.read(queries);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[]
  ): Promise<void> {
    return this.local.update(updates);
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
      this.ensurePolling();
    }

    const notify = async () => {
      const [result] = await this.local.read([query]);
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
          this.maybeStopPolling();
        }
      }
    };
  }

  private ensurePolling(): void {
    if (
      this.remoteInvalidationUnsub !== null &&
      this.remoteInvalidationUnsub !== undefined
    )
      return;
    const pollDriver = this.options.pollDriver ?? 'remote-invalidation';
    this.remoteInvalidationUnsub =
      this.options.remoteInvalidationSource.subscribe(() => {
        if (pollDriver !== 'remote-invalidation') return;
        fireAndForget(this.poll(), {
          component: 'SyncPatchesDb',
          op: 'poll-triggered',
        });
      });
    if (pollDriver === 'remote-invalidation') {
      fireAndForget(this.poll(), {
        component: 'SyncPatchesDb',
        op: 'poll-initial',
      });
    }
  }

  private maybeStopPolling(): void {
    if (
      this.activeQueries.size === 0 &&
      this.remoteInvalidationUnsub !== null &&
      this.remoteInvalidationUnsub !== undefined
    ) {
      this.remoteInvalidationUnsub();
      this.remoteInvalidationUnsub = null;
    }
  }

  private ensurePushTimer(): void {
    if (this.pushScheduleHandle !== null && this.pushScheduleHandle !== undefined)
      return;
    const pushDriver = this.options.pushDriver ?? 'interval';
    if (pushDriver === 'manual') return;
    const pushIntervalMs = this.options.pushIntervalMs ?? 2000;
    const scheduler =
      this.options.pushScheduler ?? defaultSyncPatchesDbPushScheduler;
    this.pushScheduleHandle = scheduler.scheduleInterval(
      pushIntervalMs,
      () => {
        fireAndForget(this.pushUnsynced(), {
          component: 'SyncPatchesDb',
          op: 'pushUnsynced',
        });
      }
    );
  }

  private async pushUnsynced(): Promise<void> {
    try {
      const [result] = await this.local.read([
        {
          on: 'patches',
          where: {
            type: 'not_exists',
            attribute: 'patch/syncedAt',
          },
        },
      ]);
      assert.ok(
        result !== null && result !== undefined,
        'read([query]) must return one result'
      );
      const patches = result.patches;
      if (patches.length === 0) {
        this.pushConsecutiveFailures = 0;
        return;
      }
      await this.remote.write(patches);
      await this.local.update(
        patches.map((p) => ({
          patchId: p.patchId,
          attributes: { 'patch/syncedAt': '1' },
        }))
      );
      this.pushConsecutiveFailures = 0;
      this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    } catch (err) {
      this.pushConsecutiveFailures += 1;
      console.error('[SyncPatchesDb] push failed:', err, {
        consecutiveFailures: this.pushConsecutiveFailures,
      });
      if (this.pushConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.pubSub.publish(SYNC_ERROR_TOPIC, {
          source: 'push',
          error: err,
        } satisfies SyncErrorEvent);
      }
    }
  }

  private async buildSyncQueries(
    entries: ActiveQuery[]
  ): Promise<PatchesDbQuery[]> {
    const syncQueries: PatchesDbQuery[] = [];
    for (const { query } of entries) {
      const { limit, offset, ...queryWithoutPagination } = query;
      const [localResult] = await this.local.read([queryWithoutPagination]);
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
          const [trackedResult] = await this.local.read([
            { entityType: query.entityType, entityId: entityIds },
          ]);
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
        await this.local.write(withSynced);
        hasNewPatches = true;
      }
    }
    return hasNewPatches;
  }

  private async poll(): Promise<void> {
    const entries = Array.from(this.activeQueries.values());
    if (entries.length === 0) return;
    if (this.pollInProgress) return;

    this.pollInProgress = true;
    try {
      const syncQueries = await this.buildSyncQueries(entries);
      const results = await this.remote.read(syncQueries);
      const hasNewPatches = await this.mergeRemotePatches(results);
      this.pollConsecutiveFailures = 0;
      if (hasNewPatches) {
        this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
      }
    } catch (err) {
      this.pollConsecutiveFailures += 1;
      console.error('[SyncPatchesDb] poll failed:', err, {
        consecutiveFailures: this.pollConsecutiveFailures,
      });
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
