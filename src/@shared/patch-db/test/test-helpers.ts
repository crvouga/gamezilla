import type { Unsubscribe } from "../../pub-sub/interface";
import { InMemoryPubSub } from "../../pub-sub/impl-in-memory";
import { SqlClientImplBunSqlite } from "../../sql-client/impl-bun-sqlite";
import type { SqlClient } from "../../sql-client/interface";
import { SyncPatchesDb, type RemoteInvalidationSource } from "../impl-sync";
import { PatchDbImplSqlite } from "../impl-sqlite/impl-sqlite";
import type { PatchesDb, PatchInput, SyncStatePatchesDb } from "../interface";

/** Creates a RemoteInvalidationSource that tests can trigger manually via invalidate(). */
export function createManualRemoteInvalidationSource(): RemoteInvalidationSource & { invalidate: () => void } {
    const callbacks: (() => void)[] = [];
    return {
        subscribe(callback: () => void): Unsubscribe {
            callbacks.push(callback);
            return () => {
                const i = callbacks.indexOf(callback);
                if (i >= 0) callbacks.splice(i, 1);
            };
        },
        invalidate() {
            callbacks.forEach((c) => c());
        },
    };
}

export type DbFactory = () => Promise<{ db: PatchesDb; teardown: () => Promise<void> }>;

export async function createSqliteFactory(): Promise<{ db: PatchesDb; teardown: () => Promise<void> }> {
    const client: SqlClient = SqlClientImplBunSqlite.open(":memory:");
    await client.connect();
    const db = new PatchDbImplSqlite(client);
    await db.migrate();
    return { db, teardown: () => client.disconnect() };
}

export const implementations: { name: string; factory: DbFactory }[] = [
    { name: "PatchDbImplSqlite", factory: createSqliteFactory },
];

export type SyncDbFixture = {
    syncDb: SyncPatchesDb;
    local: SyncStatePatchesDb;
    remote: PatchesDb;
    pubSub: InMemoryPubSub;
    /** Call to trigger a poll (simulates remote invalidation). */
    invalidateRemote: () => void;
    teardown: () => Promise<void>;
};

export async function createSyncDbFactory(options?: {
    pushIntervalMs?: number;
}): Promise<SyncDbFixture> {
    const localClient: SqlClient = SqlClientImplBunSqlite.open(":memory:");
    const remoteClient: SqlClient = SqlClientImplBunSqlite.open(":memory:");
    await localClient.connect();
    await remoteClient.connect();

    const local = new PatchDbImplSqlite(localClient);
    const remote = new PatchDbImplSqlite(remoteClient);
    await local.migrate();
    await remote.migrate();

    const pubSub = new InMemoryPubSub();
    const remoteInvalidationSource = createManualRemoteInvalidationSource();
    const syncDb = new SyncPatchesDb(local, remote, pubSub, {
        pushIntervalMs: options?.pushIntervalMs ?? 10,
        remoteInvalidationSource,
    });

    return {
        syncDb,
        local,
        remote,
        pubSub,
        invalidateRemote: () => remoteInvalidationSource.invalidate(),
        teardown: async () => {
            syncDb.destroy();
            await localClient.disconnect();
            await remoteClient.disconnect();
        },
    };
}

/** Fixture data for where-clause tests: t1 (score 10, tag a), t2 (20, b), t3 (30, a), t4 (40, no tag) */
export const whereClauseFixtures: PatchInput[] = [
    {
        entityId: "t1",
        entityType: "item",
        attributes: { name: "Alpha Widget", score: 10, tag: "a" },
    },
    {
        entityId: "t2",
        entityType: "item",
        attributes: { name: "Beta Gadget", score: 20, tag: "b" },
    },
    {
        entityId: "t3",
        entityType: "item",
        attributes: { name: "Gamma Tool", score: 30, tag: "a" },
    },
    {
        entityId: "t4",
        entityType: "item",
        attributes: { name: "Delta Device", score: 40 },
    },
];
