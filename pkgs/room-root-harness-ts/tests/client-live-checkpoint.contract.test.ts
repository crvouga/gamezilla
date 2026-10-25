import { describe, expect, test } from 'bun:test';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared-ts/client-storage';
import { WebClientStorage } from '@pkgs/room-adapter-web-shared-ts/client-storage';
import { keyValueRoomClientKeywords } from '@pkgs/room-root-client-ts/keys';
import { KeyValueClientRoomStorage } from '@pkgs/room-root-client-ts/storage';
import { AddOne, TallyChanged } from '@pkgs/room-root-harness-ts/game-room';
import type { ClientRoomStorage } from '@pkgs/room-root-shared-ts/core-storage';
import { ROOM_LIVE_CHECKPOINT_MAX_BYTES } from '@pkgs/room-root-shared-ts/live-checkpoint';
import fc from 'fast-check';

function stores(kind: 'memory' | 'web' | 'kv') {
  const bytes = new Map<string, string>();
  const web = {
    getItem: (key: string) => bytes.get(key) ?? null,
    setItem: (key: string, value: string) => {
      bytes.set(key, value);
    },
    removeItem: (key: string) => {
      bytes.delete(key);
    },
  };
  const kv = new KvImplInMemory();
  const keys = keyValueRoomClientKeywords('client-recovery');
  const memory = new InMemoryClientStorage();
  const reopen = (): ClientRoomStorage =>
    kind === 'memory'
      ? memory
      : kind === 'web'
        ? new WebClientStorage('client-recovery', web)
        : new KeyValueClientRoomStorage(kv, keys.committed, keys.queue);
  return { storage: reopen(), reopen, bytes, kv };
}

for (const kind of ['memory', 'web', 'kv'] as const)
  describe(kind, () => {
    test('live frames replace one bounded value without changing committed history or queued choices', async () => {
      await assertProperty(
        `client live checkpoint replacement ${kind}`,
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 1000 }), {
            minLength: 1,
            maxLength: 60,
          }),
          async (frames) => {
            const { storage, reopen, bytes } = stores(kind);
            const entries = [{ seq: 1, event: TallyChanged({ by: 1 }) }];
            const queue = [{ id: 'choice', ts: 0, payload: AddOne({}) }];
            await storage.appendCommitted(entries);
            await storage.saveQueued(queue);
            for (const by of frames)
              expect(
                await storage.replaceLiveCheckpoint(1, TallyChanged({ by }))
              ).toBe(true);
            const loaded = reopen();
            expect((await loaded.loadLiveCheckpoint())?.payload).toEqual(
              TallyChanged({ by: frames.at(-1)! })
            );
            expect(await loaded.loadCommitted()).toEqual({
              lastSeq: 1,
              entries,
            });
            expect(await loaded.loadQueued()).toEqual(queue);
            if (kind === 'web') expect(bytes.size).toBe(4);
          }
        )
      );
    });

    test('a writer with an older durable tip cannot overwrite the current frame', async () => {
      const { storage, reopen } = stores(kind);
      await storage.replaceLiveCheckpoint(0, TallyChanged({ by: 3 }));
      const next = reopen();
      await next.appendCommitted([{ seq: 1, event: TallyChanged({ by: 1 }) }]);
      await next.replaceLiveCheckpoint(1, TallyChanged({ by: 6 }));
      expect(
        await storage.replaceLiveCheckpoint(0, TallyChanged({ by: 0 }))
      ).toBe(false);
      expect((await reopen().loadLiveCheckpoint())?.payload).toEqual(
        TallyChanged({ by: 6 })
      );
    });

    test('oversized UTF-8 replacements and external aliases cannot damage the saved frame', async () => {
      const { storage } = stores(kind);
      const payload = { type: TallyChanged.type, payload: { by: 6 } };
      await storage.replaceLiveCheckpoint(0, payload);
      payload.payload.by = 0;
      const read = await storage.loadLiveCheckpoint();
      (read!.payload.payload as { by: number }).by = 1;
      await expect(
        storage.replaceLiveCheckpoint(0, {
          type: TallyChanged.type,
          payload: '🌕'.repeat(ROOM_LIVE_CHECKPOINT_MAX_BYTES / 4),
        })
      ).rejects.toThrow('byte limit');
      expect((await storage.loadLiveCheckpoint())?.payload).toEqual(
        TallyChanged({ by: 6 })
      );
    });

    test('resetting a discarded cache removes live bytes while retaining unsent choices', async () => {
      const { storage, reopen } = stores(kind);
      const queue = [{ id: 'choice', ts: 0, payload: AddOne({}) }];
      await storage.saveQueued(queue);
      await storage.replaceLiveCheckpoint(0, TallyChanged({ by: 6 }));
      await storage.resetCommitted();
      expect(await reopen().loadLiveCheckpoint()).toBeNull();
      expect(await reopen().loadQueued()).toEqual(queue);
    });
  });

test('an interrupted KV transaction retains the previous live frame', async () => {
  const { storage, kv, reopen } = stores('kv');
  await storage.replaceLiveCheckpoint(0, TallyChanged({ by: 6 }));
  kv.armFault(new Error('storage unavailable'));
  await expect(
    storage.replaceLiveCheckpoint(0, TallyChanged({ by: 9 }))
  ).rejects.toThrow('storage unavailable');
  expect((await reopen().loadLiveCheckpoint())?.payload).toEqual(
    TallyChanged({ by: 6 })
  );
});
