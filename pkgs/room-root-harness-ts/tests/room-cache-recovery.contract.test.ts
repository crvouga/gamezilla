import { expect, test } from 'bun:test';
import { readTally } from '@pkgs/room-root-harness-ts/game-room';
import type { CacheDamage } from './cache-recovery-rig';
import {
  openCacheRecoveryRoom,
  RECOVERY_QUEUED_ID,
  seedCacheRecovery,
} from './cache-recovery-rig';
import { committed, tallyEntry, welcome } from './client-rig';

// regression: room-corrupt-cache-loses-offline-change
test.each<CacheDamage>(['broken sequence', 'malformed envelope'])(
  'an unsent change survives committed cache recovery and repeated offline reopening: %s',
  async (damage) => {
    const saved = await seedCacheRecovery(damage);
    for (let opening = 0; opening < 2; opening++) {
      const rig = await openCacheRecoveryRoom(saved.storage());
      try {
        expect(rig.room.getPendingQueueIds()).toEqual([RECOVERY_QUEUED_ID]);
        expect(readTally(rig.room.getSnapshot())).toBe(1);
        await rig.room.flushIo();
        expect((await rig.storage.loadQueued()).map((q) => q.id)).toEqual([
          RECOVERY_QUEUED_ID,
        ]);
      } finally {
        rig.room.destroy();
      }
    }
  }
);

// regression: room-corrupt-cache-loses-offline-change
test('a recovered offline change and another person’s change count once through repeated acknowledgements', async () => {
  const saved = await seedCacheRecovery('broken sequence');
  const first = await openCacheRecoveryRoom(saved.storage());
  try {
    expect(first.room.getPendingQueueIds()).toEqual([RECOVERY_QUEUED_ID]);
    await first.room.flushIo();
  } finally {
    first.room.destroy();
  }
  const rig = await openCacheRecoveryRoom(saved.storage());
  try {
    rig.transport.connect();
    const bob = tallyEntry(1, 'bob', 1);
    rig.transport.deliver(welcome([bob]));
    expect(readTally(rig.room.getSnapshot())).toBe(2);
    expect(rig.room.getPendingQueueIds()).toEqual([RECOVERY_QUEUED_ID]);
    const alice = tallyEntry(2, 'alice', 1);
    rig.transport.deliver(committed([alice], RECOVERY_QUEUED_ID));
    rig.transport.deliver(committed([alice], RECOVERY_QUEUED_ID));
    rig.transport.deliver(welcome([bob, alice]));
    await rig.room.flushIo();
    expect(readTally(rig.room.getSnapshot())).toBe(2);
    expect(rig.room.getPendingQueueIds()).toEqual([]);
    expect(await rig.storage.loadQueued()).toEqual([]);
  } finally {
    rig.room.destroy();
  }
  const settled = await openCacheRecoveryRoom(saved.storage());
  try {
    expect(readTally(settled.room.getSnapshot())).toBe(2);
    expect(settled.room.getPendingQueueIds()).toEqual([]);
  } finally {
    settled.room.destroy();
  }
});
