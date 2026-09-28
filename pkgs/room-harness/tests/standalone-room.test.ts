/**
 * Host seam contract: `openLoopbackRoom` runs one device linked straight to
 * its room, with no simulated network in between.
 */

import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import { ROOM_ERROR_TYPE, RoomMetaAttr } from '@pkgs/room';
import {
  counterValue,
  Increment,
  openLoopbackRoom,
  TestCounterModule,
} from '@pkgs/room-harness';
import { createHarnessAdapters } from '@pkgs/uuid';

const SETTLE_STEPS = 200;

async function openStandalone(seed: string) {
  const adapters = createHarnessAdapters({ seed });
  const errors: unknown[] = [];
  const { room } = await openLoopbackRoom({
    clock: adapters.clock,
    timers: adapters.timers,
    createId: adapters.createId,
    topic: `standalone-${seed}`,
    module: TestCounterModule,
    onError: (error) => {
      errors.push(error);
    },
  });
  /** Flush the loopback link and step virtual time until `done` holds. */
  const settle = async (done: () => boolean): Promise<void> => {
    for (let step = 0; step < SETTLE_STEPS; step += 1) {
      await room.flushIo();
      await Promise.resolve();
      if (done()) return;
      adapters.clock.advance(1);
    }
    throw new Error(`not settled by t=${String(adapters.clock.now())}ms`);
  };
  await settle(() => RoomMetaAttr.isSynced.from(room.getSnapshot()));
  return { room, errors, settle };
}

describe('standalone room over a loopback link', () => {
  test('syncs at zero, then applies an increment', async () => {
    const { room, settle } = await openStandalone('standalone-1');
    expect(counterValue(room.getSnapshot())).toBe(0);
    room.dispatch(Increment({}) as never);
    await settle(() => room.getPendingQueueIds().length === 0);
    expect(counterValue(room.getSnapshot())).toBe(1);
    room.destroy();
  });

  test('refuses an unknown command before queueing it', async () => {
    const { room, errors, settle } = await openStandalone('standalone-2');
    room.dispatch({
      type: asKeyword('space-counter-cmd/bogus'),
      payload: {},
    } as never);
    await settle(() => errors.length > 0);
    expect(errors).toEqual([
      expect.objectContaining({ type: ROOM_ERROR_TYPE.invalidCommand }),
    ]);
    expect(room.getPendingQueueIds()).toEqual([]);
    expect(counterValue(room.getSnapshot())).toBe(0);
    room.destroy();
  });
});
