import { assert } from '@pkgs/assert';
import { describe, expect, test } from 'bun:test';
import {
  toAttributeState,
  type PatchDb,
  type PatchDbContext,
  type PatchDbQuery,
  type PatchDbResult,
  type PatchInput,
  type WritePatchesResult,
} from '../interface';
import { MAX_PATCHES_PER_REQUEST } from '../transport/wire-schemas';
import { createSyncDbFactory } from './test-helpers';

/**
 * Wraps a PatchDb to (a) record the size of each `write` batch, and (b)
 * crash if any batch exceeds the wire contract — mirroring the assertion
 * baked into `PatchDbClientTransportHttpFetch` so deterministic tests catch
 * over-batches that would otherwise only show up against a real server.
 */
class WireContractRecordingRemote implements PatchDb {
  readonly hooks: PatchDb['hooks'];
  readonly compaction: PatchDb['compaction'];
  readonly writeBatches: number[] = [];

  constructor(private readonly inner: PatchDb) {
    this.hooks = inner.hooks;
    this.compaction = inner.compaction;
  }

  read(
    queries: PatchDbQuery[],
    ctx?: PatchDbContext
  ): Promise<PatchDbResult[]> {
    return this.inner.read(queries, ctx);
  }

  async write(
    patches: PatchInput[],
    ctx?: PatchDbContext
  ): Promise<WritePatchesResult> {
    assert.ok(
      patches.length > 0,
      'remote.write must never receive an empty batch',
      { length: patches.length }
    );
    assert.ok(
      patches.length <= MAX_PATCHES_PER_REQUEST,
      'remote.write must respect MAX_PATCHES_PER_REQUEST wire contract',
      { length: patches.length, max: MAX_PATCHES_PER_REQUEST }
    );
    this.writeBatches.push(patches.length);
    return this.inner.write(patches, ctx);
  }

  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    ctx?: PatchDbContext
  ): Promise<void> {
    return this.inner.update(updates, ctx);
  }
}

describe('SyncPatchDb push batching', () => {
  test('pushUnsynced chunks patches by maxPushBatchSize and pushes every patch', async () => {
    const fixture = await createSyncDbFactory({
      pushDriver: 'manual',
      pollDriver: 'manual',
      maxPushBatchSize: 3,
    });
    const recordingRemote = new WireContractRecordingRemote(fixture.syncRemote);
    const syncDb = fixture.syncDb;

    // Replace the remote on the engine via the instance field. We intercept
    // by writing 7 patches across 7 entities and expect chunk sizes 3,3,1.
    // (Tiger style: avoid reflection — we wire the recorder directly.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- swap private field for test wiring
    (syncDb as any).remote = recordingRemote;

    const PATCH_COUNT = 7;
    const inputs: PatchInput[] = [];
    for (let i = 0; i < PATCH_COUNT; i++) {
      inputs.push({
        entityId: `list-${i}`,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': `List ${i}`,
          'todo-list/order': i,
          'todo-list/created-at': new Date(0).toISOString(),
        }),
      });
    }
    await syncDb.write(inputs);

    await syncDb.runPushNow();

    expect(recordingRemote.writeBatches).toEqual([3, 3, 1]);

    const remoteAll = await fixture.remote.read([{ entityType: 'todo-list' }]);
    const result = remoteAll[0];
    assert.defined(result, 'remote result');
    expect(result.patches).toHaveLength(PATCH_COUNT);

    await fixture.teardown();
  });

  test('pushUnsynced does no work when there are no unsynced patches', async () => {
    const fixture = await createSyncDbFactory({
      pushDriver: 'manual',
      pollDriver: 'manual',
      maxPushBatchSize: 3,
    });
    const recordingRemote = new WireContractRecordingRemote(fixture.syncRemote);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- swap private field for test wiring
    (fixture.syncDb as any).remote = recordingRemote;

    await fixture.syncDb.runPushNow();

    expect(recordingRemote.writeBatches).toEqual([]);

    await fixture.teardown();
  });
});
