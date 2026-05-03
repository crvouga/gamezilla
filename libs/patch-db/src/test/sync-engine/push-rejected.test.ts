import { assert } from '@gamezilla/lib/assert';
import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { afterEach, describe, expect, test } from 'bun:test';
import { PatchDbImplSqlite } from '../../impl-sqlite/impl-sqlite';
import { SyncPatchDb } from '../../impl-sync';
import type { Patch, PatchDb, PatchInput } from '../../interface';
import {
  OPEN_PATCHES_DB_CONTEXT,
  PATCH_SYNC_REJECTED_AT,
} from '../../interface';
import { PatchDbTransportRejectedError } from '../../transport/transport-rejected-error';

function createRejectingRemote(
  inner: PatchDb,
  rejectWhen: (remoteWriteCallNumber: number) => boolean
): PatchDb {
  let writeCount = 0;
  return {
    get hooks() {
      return inner.hooks;
    },
    get compaction() {
      return inner.compaction;
    },
    read: (queries, ctx) => inner.read(queries, ctx),
    write: async (patches, ctx) => {
      writeCount += 1;
      if (rejectWhen(writeCount)) {
        throw new PatchDbTransportRejectedError(
          403,
          'simulated server rejection'
        );
      }
      return inner.write(patches, ctx);
    },
    update: (updates, ctx) => inner.update(updates, ctx),
  };
}

/** Simulates HTTP 200 with partial policy rejection (subset of chunk rejected). */
function createPartialPolicyRejectRemote(inner: PatchDb): PatchDb {
  return {
    get hooks() {
      return inner.hooks;
    },
    get compaction() {
      return inner.compaction;
    },
    read: (queries, ctx) => inner.read(queries, ctx),
    write: async (patches, ctx) => {
      if (patches.length !== 2) {
        return inner.write(patches, ctx);
      }
      const [a, b] = patches;
      assert.defined(a, 'patch a');
      assert.defined(b, 'patch b');
      const first = await inner.write([a], ctx);
      return {
        accepted: first.accepted,
        rejected: [
          {
            patchId: b.patchId!,
            code: 'forbidden',
            reason: 'simulated partial reject',
          },
        ],
      };
    },
    update: (updates, ctx) => inner.update(updates, ctx),
  };
}

describe('SyncPatchDb push rejection (401/403)', () => {
  let localClient: SqlClient;
  let remoteClient: SqlClient;
  let teardown: () => Promise<void> = async () => {};

  afterEach(async () => {
    await teardown();
  });

  test('marks chunk with syncRejectedAt and stops retrying that patch', async () => {
    localClient = SqlClientImplBunSqlite.open(':memory:');
    remoteClient = SqlClientImplBunSqlite.open(':memory:');
    await localClient.connect();
    await remoteClient.connect();
    const local = new PatchDbImplSqlite(localClient);
    const remoteInner = new PatchDbImplSqlite(remoteClient);
    await local.migrate();
    await remoteInner.migrate();
    const remote = createRejectingRemote(remoteInner, (n) => n === 1);
    const pubSub = new InMemoryPubSub();
    const syncDb = new SyncPatchDb(local, remote, pubSub, {
      pushDriver: 'manual',
      pollDriver: 'manual',
      logPushPollFailures: false,
      detectServerPatchLossOnPoll: true,
    });
    teardown = async () => {
      syncDb.destroy();
      await localClient.disconnect();
      await remoteClient.disconnect();
    };

    const patchInput: PatchInput = {
      entityId: 'e1',
      entityType: 'item',
      attributes: { 'item/name': 'one' },
    };
    await syncDb.write([patchInput]);
    await syncDb.runPushNow();
    await syncDb.runPushNow();

    const [localPatches] = await local.read(
      [{ on: 'patches', limit: 10 }],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.defined(localPatches, 'localPatches');
    expect(localPatches.patches).toHaveLength(1);
    const p = localPatches.patches[0];
    assert.defined(p, 'patch');
    expect(p.attributes[PATCH_SYNC_REJECTED_AT]).toBeTruthy();
    expect(p.attributes['patch/syncedAt']).toBeNull();

    const [remotePatches] = await remoteInner.read(
      [{ on: 'patches', limit: 10 }],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.defined(remotePatches, 'remotePatches');
    expect(remotePatches.patches).toHaveLength(0);
  });

  test('first chunk succeeds then rejected chunk leaves prior synced', async () => {
    localClient = SqlClientImplBunSqlite.open(':memory:');
    remoteClient = SqlClientImplBunSqlite.open(':memory:');
    await localClient.connect();
    await remoteClient.connect();
    const local = new PatchDbImplSqlite(localClient);
    const remoteInner = new PatchDbImplSqlite(remoteClient);
    await local.migrate();
    await remoteInner.migrate();
    const remote = createRejectingRemote(remoteInner, (n) => n === 2);
    const pubSub = new InMemoryPubSub();
    const syncDb = new SyncPatchDb(local, remote, pubSub, {
      pushDriver: 'manual',
      pollDriver: 'manual',
      maxPushBatchSize: 1,
      logPushPollFailures: false,
      detectServerPatchLossOnPoll: true,
    });
    teardown = async () => {
      syncDb.destroy();
      await localClient.disconnect();
      await remoteClient.disconnect();
    };

    await syncDb.write([
      {
        entityId: 'a',
        entityType: 'item',
        attributes: { 'item/name': 'first' },
      },
      {
        entityId: 'b',
        entityType: 'item',
        attributes: { 'item/name': 'second' },
      },
    ]);
    await syncDb.runPushNow();

    const [allLocal] = await local.read(
      [{ on: 'patches', limit: 20 }],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.defined(allLocal, 'allLocal');
    const synced = allLocal.patches.filter(
      (x) =>
        x.attributes['patch/syncedAt'] !== undefined &&
        x.attributes['patch/syncedAt'] !== null
    );
    const rejected = allLocal.patches.filter(
      (x) =>
        x.attributes[PATCH_SYNC_REJECTED_AT] !== undefined &&
        x.attributes[PATCH_SYNC_REJECTED_AT] !== null
    );
    expect(synced).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const [remotePatches] = await remoteInner.read(
      [{ on: 'patches', limit: 20 }],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.defined(remotePatches, 'remotePatches');
    expect(remotePatches.patches).toHaveLength(1);
  });

  test('clearRejectedPushes then push delivers to remote', async () => {
    localClient = SqlClientImplBunSqlite.open(':memory:');
    remoteClient = SqlClientImplBunSqlite.open(':memory:');
    await localClient.connect();
    await remoteClient.connect();
    const local = new PatchDbImplSqlite(localClient);
    const remoteInner = new PatchDbImplSqlite(remoteClient);
    await local.migrate();
    await remoteInner.migrate();
    const remote = createRejectingRemote(remoteInner, (n) => n === 1);
    const pubSub = new InMemoryPubSub();
    const syncDb = new SyncPatchDb(local, remote, pubSub, {
      pushDriver: 'manual',
      pollDriver: 'manual',
      logPushPollFailures: false,
      detectServerPatchLossOnPoll: true,
    });
    teardown = async () => {
      syncDb.destroy();
      await localClient.disconnect();
      await remoteClient.disconnect();
    };

    await syncDb.write([
      {
        entityId: 'z1',
        entityType: 'item',
        attributes: { 'item/name': 'z' },
      },
    ]);
    await syncDb.runPushNow();
    await syncDb.clearRejectedPushes();
    await syncDb.runPushNow();

    const [remotePatches] = await remoteInner.read(
      [{ on: 'patches', limit: 10 }],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.defined(remotePatches, 'remotePatches');
    expect(remotePatches.patches).toHaveLength(1);
  });

  test('200 partial reject: syncs accepted patches and marks rejected locally', async () => {
    localClient = SqlClientImplBunSqlite.open(':memory:');
    remoteClient = SqlClientImplBunSqlite.open(':memory:');
    await localClient.connect();
    await remoteClient.connect();
    const local = new PatchDbImplSqlite(localClient);
    const remoteInner = new PatchDbImplSqlite(remoteClient);
    await local.migrate();
    await remoteInner.migrate();
    const remote = createPartialPolicyRejectRemote(remoteInner);
    const pubSub = new InMemoryPubSub();
    const syncDb = new SyncPatchDb(local, remote, pubSub, {
      pushDriver: 'manual',
      pollDriver: 'manual',
      maxPushBatchSize: 10,
      logPushPollFailures: false,
      detectServerPatchLossOnPoll: true,
    });
    teardown = async () => {
      syncDb.destroy();
      await localClient.disconnect();
      await remoteClient.disconnect();
    };

    await syncDb.write([
      {
        entityId: 'p1',
        entityType: 'item',
        attributes: { 'item/name': 'a' },
      },
      {
        entityId: 'p2',
        entityType: 'item',
        attributes: { 'item/name': 'b' },
      },
    ]);
    await syncDb.runPushNow();

    const [localPatches] = await local.read(
      [{ on: 'patches', limit: 20 }],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.defined(localPatches, 'localPatches');
    expect(localPatches.patches).toHaveLength(2);
    const synced = localPatches.patches.filter(
      (x: Patch) =>
        x.attributes['patch/syncedAt'] !== undefined &&
        x.attributes['patch/syncedAt'] !== null
    );
    const rejected = localPatches.patches.filter(
      (x: Patch) =>
        x.attributes[PATCH_SYNC_REJECTED_AT] !== undefined &&
        x.attributes[PATCH_SYNC_REJECTED_AT] !== null
    );
    expect(synced).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const [remotePatches] = await remoteInner.read(
      [{ on: 'patches', limit: 20 }],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.defined(remotePatches, 'remotePatches');
    expect(remotePatches.patches).toHaveLength(1);
  });
});
