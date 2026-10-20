import { test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { AddOne, TakeOne } from '@pkgs/room-root-harness/game-room';
import fc from 'fast-check';
import type { RecoveryModel, RecoveryReal } from './cache-recovery-model';
import {
  acknowledgePending,
  assertRecoveryState,
  receiveHistory,
  receiveOtherChange,
  reopenCachedClient,
  repeatAcknowledgment,
} from './cache-recovery-model';
import { openClient, tallyEntry } from './client-rig';
import { CountingClientStorage } from './memory-storage';

const changes = fc.array(fc.constantFrom(1 as const, -1 as const), {
  minLength: 1,
  maxLength: 8,
});
const commands = fc.commands(
  [
    fc.constant(reopenCachedClient()),
    fc.constant(receiveHistory()),
    fc.constant(acknowledgePending()),
    fc.constant(repeatAcknowledgment()),
    fc.constantFrom(1 as const, -1 as const).map(receiveOtherChange),
  ],
  { maxCommands: 15 }
);

test('cache recovery preserves protocol queue identity across reopening and frame interleavings', async () => {
  await assertProperty(
    'room-cache-recovery',
    fc.asyncProperty(
      changes,
      changes,
      fc.integer({ min: 2, max: 100 }),
      commands,
      async (pendingChanges, history, badSeq, steps) => {
        const storage = new CountingClientStorage();
        storage.entries = [tallyEntry(badSeq, 'bob', 1)];
        const pending = pendingChanges.map((by, i) => ({
          id: `offline-${i}`,
          by,
        }));
        storage.queue = pending.map(({ id, by }) => ({
          id,
          ts: 1000,
          payload: by === 1 ? AddOne({}) : TakeOne({}),
        }));
        const model: RecoveryModel = {
          pending,
          server: [...history],
          local: [],
          synced: false,
          lastAck: null,
        };
        const real: RecoveryReal = { rig: await openClient(storage), storage };
        try {
          await assertRecoveryState(model, real);
          await fc.asyncModelRun(() => ({ model, real }), steps);
        } finally {
          real.rig.room.destroy();
        }
      }
    )
  );
});
