import type { PubSub, Unsubscribe } from '../../pub-sub/interface';
import type {
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';

const PATCHES_DB_TOPIC = 'patches-db';

export type RemoteInvalidationSource = {
  subscribe(callback: () => void): Unsubscribe;
};

export type SyncPatchesDbOptions = {
  pushIntervalMs?: number;
  remoteInvalidationSource: RemoteInvalidationSource;
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
  private pushTimer: ReturnType<typeof setInterval> | null = null;
  private remoteInvalidationUnsub: Unsubscribe | null = null;
  private pollInProgress = false;

  constructor(
    private local: PatchesDb,
    private remote: PatchesDb,
    private pubSub: PubSub,
    private options: SyncPatchesDbOptions
  ) {
    this.ensurePushTimer();
  }

  /** Stops push timer and remote invalidation subscription. Call before disposing of the db. */
  destroy(): void {
    if (this.pushTimer != null) {
      clearInterval(this.pushTimer);
      this.pushTimer = null;
    }
    if (this.remoteInvalidationUnsub != null) {
      this.remoteInvalidationUnsub();
      this.remoteInvalidationUnsub = null;
    }
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    const withUnsynced = patches.map((p) => ({
      ...p,
      meta: { ...p.meta, syncedAt: null },
    }));
    const result = await this.local.write(withUnsynced);
    this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    return result;
  }

  readEntities(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return this.local.readEntities(queries);
  }

  async updateMetadata(
    updates: { patchId: string; metadata: Record<string, unknown> }[]
  ): Promise<void> {
    return this.local.updateMetadata(updates);
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
      const [result] = await this.local.readEntities([query]);
      listener(result);
    };
    void notify();

    const unsub = this.pubSub.subscribe(PATCHES_DB_TOPIC, () => {
      void notify();
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
    if (this.remoteInvalidationUnsub != null) return;
    this.remoteInvalidationUnsub =
      this.options.remoteInvalidationSource.subscribe(() => {
        void this.poll();
      });
    void this.poll();
  }

  private maybeStopPolling(): void {
    if (this.activeQueries.size === 0 && this.remoteInvalidationUnsub != null) {
      this.remoteInvalidationUnsub();
      this.remoteInvalidationUnsub = null;
    }
  }

  private ensurePushTimer(): void {
    if (this.pushTimer != null) return;
    const pushIntervalMs = this.options.pushIntervalMs ?? 2000;
    this.pushTimer = setInterval(() => {
      void this.pushUnsynced();
    }, pushIntervalMs);
  }

  private async pushUnsynced(): Promise<void> {
    try {
      const [result] = await this.local.readEntities([
        {
          where: {
            type: 'not_exists',
            attribute: 'syncedAt',
            source: 'metadata',
          },
        },
      ]);
      const patches = result.patches;
      if (patches.length === 0) return;
      await this.remote.write(patches);
      await this.local.updateMetadata(
        patches.map((p) => ({
          patchId: p.patchId,
          metadata: { syncedAt: '1' },
        }))
      );
      this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
    } catch (err) {
      console.warn('[SyncPatchesDb] push failed:', err);
    }
  }

  private async poll(): Promise<void> {
    const entries = Array.from(this.activeQueries.values());
    if (entries.length === 0) return;
    if (this.pollInProgress) return;

    this.pollInProgress = true;
    try {
      const syncQueries: PatchesDbQuery[] = [];
      for (const { query } of entries) {
        const { limit, offset, ...queryWithoutPagination } = query;
        const [localResult] = await this.local.readEntities([
          queryWithoutPagination,
        ]);
        syncQueries.push({
          ...queryWithoutPagination,
          knownPatches: localResult.patches,
        });

        if (query.where != null) {
          const entityIds = [
            ...new Set(localResult.patches.map((p) => p.entityId)),
          ];
          if (entityIds.length > 0) {
            const [trackedResult] = await this.local.readEntities([
              { entityType: query.entityType, entityId: entityIds },
            ]);
            syncQueries.push({
              entityType: query.entityType,
              entityId: entityIds,
              knownPatches: trackedResult.patches,
            });
          }
        }
      }

      const results = await this.remote.readEntities(syncQueries);

      let hasNewPatches = false;
      for (const remoteResult of results) {
        if (remoteResult.patches.length > 0) {
          const withSynced = remoteResult.patches.map((p) => ({
            ...p,
            meta: { ...p.meta, syncedAt: '1' },
          }));
          await this.local.write(withSynced);
          hasNewPatches = true;
        }
      }
      if (hasNewPatches) {
        this.pubSub.publish(PATCHES_DB_TOPIC, { type: 'invalidated' });
      }
    } catch (err) {
      console.warn('[SyncPatchesDb] poll failed:', err);
    } finally {
      this.pollInProgress = false;
    }
  }
}
