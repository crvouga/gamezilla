import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { PatchesDbQuery } from "../interface";
import { createSyncDbFactory } from "./test-helpers";

const PUSH_WAIT_MS = 100;
const POLL_WAIT_MS = 100;

const DELETED_CLAUSE: PatchesDbQuery["where"] = {
    type: "or",
    clauses: [
        { type: "not_exists", attribute: "deleted" },
        { type: "=", attribute: "deleted", value: false },
    ],
};

describe("SyncPatchesDb", () => {
    let syncDb: Awaited<ReturnType<typeof createSyncDbFactory>>;

    beforeEach(async () => {
        syncDb = await createSyncDbFactory();
    });

    afterEach(async () => {
        await syncDb.teardown();
    });

    test("push: create patch is pushed to remote", async () => {
        const listId = crypto.randomUUID();
        await syncDb.syncDb.write([
            {
                entityId: listId,
                entityType: "todoList",
                attributes: {
                    name: "My List",
                    order: 0,
                    createdAt: new Date().toISOString(),
                },
            },
        ]);

        await new Promise((r) => setTimeout(r, PUSH_WAIT_MS));

        const [remoteResult] = await syncDb.remote.readPatches([
            { entityType: "todoList", entityId: listId },
        ]);
        expect(remoteResult.data).toHaveLength(1);
        expect(remoteResult.data[0].attributes).toMatchObject({
            name: "My List",
            order: 0,
        });
    });

    test("push: soft-delete patch is pushed to remote", async () => {
        const listId = crypto.randomUUID();
        await syncDb.syncDb.write([
            {
                entityId: listId,
                entityType: "todoList",
                attributes: {
                    name: "My List",
                    order: 0,
                    createdAt: new Date().toISOString(),
                },
            },
        ]);

        await new Promise((r) => setTimeout(r, PUSH_WAIT_MS));

        await syncDb.syncDb.write([
            {
                entityId: listId,
                entityType: "todoList",
                attributes: { deleted: true },
            },
        ]);

        await new Promise((r) => setTimeout(r, PUSH_WAIT_MS));

        const [remoteResult] = await syncDb.remote.readPatches([
            { entityType: "todoList", entityId: listId },
        ]);
        expect(remoteResult.data).toHaveLength(2);
        const deletePatch = remoteResult.data.find(
            (p) => p.attributes && "deleted" in p.attributes && (p.attributes as { deleted: boolean }).deleted === true
        );
        expect(deletePatch).toBeDefined();
        expect(deletePatch!.attributes).toEqual({ deleted: true });
    });

    test("push: multiple unsynced patches are all pushed", async () => {
        const listId1 = crypto.randomUUID();
        const listId2 = crypto.randomUUID();
        await syncDb.syncDb.write([
            {
                entityId: listId1,
                entityType: "todoList",
                attributes: { name: "List 1", order: 0, createdAt: new Date().toISOString() },
            },
            {
                entityId: listId2,
                entityType: "todoList",
                attributes: { name: "List 2", order: 1, createdAt: new Date().toISOString() },
            },
        ]);

        await new Promise((r) => setTimeout(r, PUSH_WAIT_MS));

        const [r1] = await syncDb.remote.readPatches([{ entityType: "todoList", entityId: listId1 }]);
        const [r2] = await syncDb.remote.readPatches([{ entityType: "todoList", entityId: listId2 }]);
        expect(r1.data).toHaveLength(1);
        expect(r2.data).toHaveLength(1);
        expect(r1.data[0].attributes).toMatchObject({ name: "List 1" });
        expect(r2.data[0].attributes).toMatchObject({ name: "List 2" });
    });

    test("poll: remote patches are merged into local", async () => {
        const listId = crypto.randomUUID();
        await syncDb.remote.write([
            {
                entityId: listId,
                entityType: "todoList",
                attributes: {
                    name: "From Remote",
                    order: 0,
                    createdAt: new Date().toISOString(),
                },
            },
        ]);

        const received: unknown[] = [];
        const unsub = syncDb.syncDb.subscribe.entities(
            { entityType: "todoList", where: DELETED_CLAUSE },
            (result) => {
                received.push(result.data);
            }
        );

        await new Promise((r) => setTimeout(r, POLL_WAIT_MS));

        unsub();

        expect(received.length).toBeGreaterThanOrEqual(1);
        const last = received[received.length - 1] as { entityId: string; attributes: Record<string, unknown> }[];
        expect(last.some((e) => e.entityId === listId && e.attributes?.name === "From Remote")).toBe(true);
    });

    test("poll: patches for deleted entities are fetched via tracked-entities query", async () => {
        const listId = crypto.randomUUID();
        await syncDb.remote.write([
            {
                entityId: listId,
                entityType: "todoList",
                attributes: {
                    name: "To Be Deleted",
                    order: 0,
                    createdAt: new Date().toISOString(),
                },
            },
        ]);

        const received: { entityId: string; attributes: Record<string, unknown> }[][] = [];
        const unsub = syncDb.syncDb.subscribe.entities(
            { entityType: "todoList", where: DELETED_CLAUSE },
            (result) => {
                received.push(result.data as { entityId: string; attributes: Record<string, unknown> }[]);
            }
        );

        await new Promise((r) => setTimeout(r, POLL_WAIT_MS));

        expect(received.some((r) => r.some((e) => e.entityId === listId))).toBe(true);

        await syncDb.remote.write([
            {
                entityId: listId,
                entityType: "todoList",
                attributes: { deleted: true },
            },
        ]);

        await new Promise((r) => setTimeout(r, POLL_WAIT_MS));

        unsub();

        const entitiesResult = await syncDb.syncDb.readEntities({
            entityType: "todoList",
            entityId: listId,
        });
        const entity = entitiesResult.data[0];
        expect(entity).toBeDefined();
        expect(entity?.attributes?.deleted).toBe(true);
    });
});
