import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { DurableObjectRoomStorage } from '@pkgs/room-adapter-durable-object-shared-ts/storage';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';
import { TallyChanged } from '@pkgs/room-root-harness-ts/game-room';
import { ROOM_LIVE_CHECKPOINT_MAX_BYTES } from '@pkgs/room-root-shared-ts/live-checkpoint';
import type { RoomStorage } from '@pkgs/room-root-shared-ts/server-core-storage';
import fc from 'fast-check';
import { MemoryKv } from './memory-kv';

const topic = 'room:recovery';
function stores(kind: 'memory' | 'durable') {
  const kv = new MemoryKv();
  const storage: RoomStorage =
    kind === 'memory'
      ? new InMemoryRoomStorage()
      : new DurableObjectRoomStorage(kv);
  return {
    storage,
    kv,
    reopen: () =>
      kind === 'memory' ? storage : new DurableObjectRoomStorage(kv),
  };
}

for (const kind of ['memory', 'durable'] as const)
  describe(kind, () => {
    test('live frames replace one value without growing the event or retry journal', async () => {
      await assertProperty(
        `room live checkpoint bounded replacement ${kind}`,
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 1000 }), {
            minLength: 1,
            maxLength: 100,
          }),
          async (frames) => {
            const { storage, kv } = stores(kind);
            for (const tick of frames)
              expect(
                await storage.replaceLiveCheckpoint(
                  topic,
                  0,
                  TallyChanged({ by: tick })
                )
              ).toBe(true);
            expect((await storage.loadLiveCheckpoint(topic))?.payload).toEqual(
              TallyChanged({ by: frames.at(-1)! })
            );
            expect(await storage.loadEventsAfter(topic, 0)).toEqual([]);
            expect(await storage.getLastSeq(topic)).toBe(0);
            if (kind === 'durable') expect(kv.values.size).toBe(2);
          }
        )
      );
    });

    test('a stale writer cannot replace a checkpoint after the durable log advances', async () => {
      const { storage, reopen } = stores(kind);
      await storage.getLastSeq(topic);
      await storage.replaceLiveCheckpoint(topic, 0, TallyChanged({ by: 3 }));
      const writer = reopen();
      await writer.commitCommand(topic, 'next', [
        { seq: 1, event: TallyChanged({ by: 1 }) },
      ]);
      await writer.replaceLiveCheckpoint(topic, 1, TallyChanged({ by: 6 }));
      expect(
        await storage.replaceLiveCheckpoint(topic, 0, TallyChanged({ by: 4 }))
      ).toBe(false);
      expect((await reopen().loadLiveCheckpoint(topic))?.payload).toEqual(
        TallyChanged({ by: 6 })
      );
    });

    test('over-limit UTF-8 frames preserve the last valid checkpoint', async () => {
      const { storage } = stores(kind);
      await storage.replaceLiveCheckpoint(topic, 0, TallyChanged({ by: 3 }));
      const huge = {
        type: TallyChanged.type,
        payload: '🌕'.repeat(ROOM_LIVE_CHECKPOINT_MAX_BYTES / 4),
      };
      await expect(
        storage.replaceLiveCheckpoint(topic, 0, huge)
      ).rejects.toThrow('byte limit');
      expect((await storage.loadLiveCheckpoint(topic))?.payload).toEqual(
        TallyChanged({ by: 3 })
      );
    });

    test('erasure rewrites recovery bytes together with the log and retry outcomes', async () => {
      const { storage } = stores(kind);
      await storage.replaceLiveCheckpoint(topic, 0, {
        type: TallyChanged.type,
        payload: { owner: 'alice' },
      });
      await storage.eraseIdentity(
        topic,
        { identity: 'alice', replacement: 'deleted:person' },
        {
          commandId: 'erasure',
          entry: { seq: 1, event: TallyChanged({ by: 0 }) },
        }
      );
      expect(
        (await storage.loadLiveCheckpoint(topic))?.payload.payload
      ).toEqual({ owner: 'deleted:person' });
      expect(await storage.getLastSeq(topic)).toBe(1);
      expect(await storage.getDedupOutcome(topic, 'erasure')).not.toBeNull();
    });

    test('snapshot reads cannot mutate saved recovery bytes', async () => {
      const { storage } = stores(kind);
      const frame = { type: TallyChanged.type, payload: { by: 6 } };
      await storage.replaceLiveCheckpoint(topic, 0, frame);
      frame.payload.by = 0;
      const read = await storage.loadLiveCheckpoint(topic);
      (read!.payload.payload as { by: number }).by = 1;
      expect((await storage.loadLiveCheckpoint(topic))?.payload).toEqual(
        TallyChanged({ by: 6 })
      );
      expect(await storage.replaceLiveCheckpoint(topic, 0, null)).toBe(true);
      expect(await storage.loadLiveCheckpoint(topic)).toBeNull();
    });
  });

test('an interrupted Durable Object replacement retains its previous frame', async () => {
  const { storage, kv, reopen } = stores('durable');
  await storage.replaceLiveCheckpoint(topic, 0, TallyChanged({ by: 3 }));
  kv.failPutNumber = kv.puts + 1;
  await expect(
    storage.replaceLiveCheckpoint(topic, 0, TallyChanged({ by: 6 }))
  ).rejects.toThrow('interrupted write');
  expect((await reopen().loadLiveCheckpoint(topic))?.payload).toEqual(
    TallyChanged({ by: 3 })
  );
});
