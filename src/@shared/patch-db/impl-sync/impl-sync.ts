import type { PubSub, Unsubscribe } from "../../pub-sub/interface";
import type {
    Entity,
    Patch,
    PatchesDb,
    PatchesDbQuery,
    PatchesDbResult,
    PatchInput,
    SyncStatePatchesDb,
} from "../interface";

const PATCHES_DB_TOPIC = "patches-db";

export type SyncPatchesDbOptions = {
    pollIntervalMs?: number;
    pushIntervalMs?: number;
};

type ActiveQuery = {
    query: PatchesDbQuery;
    refCount: number;
};

function getCursorPatchId(patches: Patch[]): string | null {
    if (patches.length === 0) return null;
    return patches[patches.length - 1].patchId;
}

/** Strip limit/offset so we get the true last patch in lineage order for cursor. */
function queryForCursor(query: PatchesDbQuery): PatchesDbQuery {
    const { limit, offset, ...rest } = query;
    return rest;
}

export class SyncPatchesDb implements PatchesDb {
    subscribe = {
        patches: (
            query: PatchesDbQuery,
            listener: (result: PatchesDbResult<Patch>) => void
        ): Unsubscribe => this.registerAndSubscribe(query, "patches", listener),
        entities: (
            query: PatchesDbQuery,
            listener: (result: PatchesDbResult<Entity>) => void
        ): Unsubscribe => this.registerAndSubscribe(query, "entities", listener),
    };

    private activeQueries = new Map<string, ActiveQuery>();
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private pushTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private local: SyncStatePatchesDb,
        private remote: PatchesDb,
        private pubSub: PubSub,
        private options: SyncPatchesDbOptions = {}
    ) {
        this.ensurePushTimer();
    }

    /** Stops push/poll timers. Call before disposing of the db. */
    destroy(): void {
        if (this.pushTimer != null) {
            clearInterval(this.pushTimer);
            this.pushTimer = null;
        }
        if (this.pollTimer != null) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    async write(patches: PatchInput[]): Promise<Patch[]> {
        const withUnsynced = patches.map((p) => ({
            ...p,
            meta: { ...p.meta, syncedAt: null },
        }));
        const result = await this.local.write(withUnsynced);
        this.pubSub.publish(PATCHES_DB_TOPIC, { type: "invalidated" });
        return result;
    }

    readPatches(queries: PatchesDbQuery[], knownPatches?: Patch[][]): Promise<PatchesDbResult<Patch>[]> {
        return this.local.readPatches(queries, knownPatches);
    }

    readEntities(query: PatchesDbQuery): Promise<PatchesDbResult<Entity>> {
        return this.local.readEntities(query);
    }

    private queryKey(query: PatchesDbQuery): string {
        return JSON.stringify(query);
    }

    private registerAndSubscribe<T extends Patch | Entity>(
        query: PatchesDbQuery,
        mode: "patches" | "entities",
        listener: (result: PatchesDbResult<T>) => void
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
            const result =
                mode === "patches"
                    ? ((await this.local.readPatches([query]))[0] as PatchesDbResult<T>)
                    : ((await this.local.readEntities(query)) as PatchesDbResult<T>);
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
        if (this.pollTimer != null) return;
        const pollIntervalMs = this.options.pollIntervalMs ?? 5000;
        this.pollTimer = setInterval(() => {
            void this.poll();
        }, pollIntervalMs);
    }

    private maybeStopPolling(): void {
        if (this.activeQueries.size === 0 && this.pollTimer != null) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
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
            const patches = await this.local.getUnsyncedPatches();
            if (patches.length === 0) return;
            await this.remote.write(patches);
            await this.local.markPatchesSynced(patches.map((p) => p.patchId));
            this.pubSub.publish(PATCHES_DB_TOPIC, { type: "invalidated" });
        } catch (err) {
            console.warn("[SyncPatchesDb] push failed:", err);
        }
    }

    private async poll(): Promise<void> {
        const entries = Array.from(this.activeQueries.values());
        if (entries.length === 0) return;

        try {
            const syncQueries: PatchesDbQuery[] = [];
            const knownPatches: Patch[][] = [];
            for (const { query } of entries) {
                const [localResult] = await this.local.readPatches([queryForCursor(query)]);
                const cursorPatchId = getCursorPatchId(localResult.data);
                syncQueries.push({
                    ...query,
                    after: cursorPatchId ?? undefined,
                });
                knownPatches.push(localResult.data);

                if (query.where != null) {
                    const entityIds = [...new Set(localResult.data.map((p) => p.entityId))];
                    if (entityIds.length > 0) {
                        const [trackedResult] = await this.local.readPatches([
                            { entityType: query.entityType, entityId: entityIds },
                        ]);
                        const trackedCursor = getCursorPatchId(trackedResult.data);
                        syncQueries.push({
                            entityType: query.entityType,
                            entityId: entityIds,
                            after: trackedCursor ?? undefined,
                        });
                        knownPatches.push(trackedResult.data);
                    }
                }
            }

            const results = await this.remote.readPatches(syncQueries, knownPatches);

            let hasNewPatches = false;
            for (const remoteResult of results) {
                if (remoteResult.data.length > 0) {
                    const withSynced = remoteResult.data.map((p) => ({
                        ...p,
                        meta: { ...p.meta, syncedAt: "1" },
                    }));
                    await this.local.write(withSynced);
                    hasNewPatches = true;
                }
            }
            if (hasNewPatches) {
                this.pubSub.publish(PATCHES_DB_TOPIC, { type: "invalidated" });
            }
        } catch (err) {
            console.warn("[SyncPatchesDb] poll failed:", err);
        }
    }
}
