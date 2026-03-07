import { InMemoryPubSub } from "../../pub-sub/impl-in-memory";
import { SqlClientImplBunSqlite } from "../../sql-client/impl-bun-sqlite";
import type { SqlClient } from "../../sql-client/interface";
import { SyncPatchesDb } from "../impl-sync";
import { PatchDbImplSqlite } from "../impl-sqlite/impl-sqlite";
import type { PatchesDb, PatchInput, SyncStatePatchesDb } from "../interface";

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
    teardown: () => Promise<void>;
};

export async function createSyncDbFactory(options?: {
    pushIntervalMs?: number;
    pollIntervalMs?: number;
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
    const syncDb = new SyncPatchesDb(local, remote, pubSub, {
        pushIntervalMs: options?.pushIntervalMs ?? 10,
        pollIntervalMs: options?.pollIntervalMs ?? 10,
    });

    return {
        syncDb,
        local,
        remote,
        pubSub,
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
