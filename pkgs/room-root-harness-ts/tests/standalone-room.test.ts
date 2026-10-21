/**
 * Host seam contract: `openLoopbackRoom` runs one device linked straight to
 * its room, with no simulated network in between.
 */

import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { openLoopbackRoom } from '@pkgs/room-root-harness-ts/boot-loopback';
import {
  AddOne,
  gameRoomModule,
  readTally,
} from '@pkgs/room-root-harness-ts/game-room';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';

const SETTLE_STEPS = 200;

async function openStandalone(seed: string) {
  const adapters = createHarnessAdapters({ seed });
  const errors: unknown[] = [];
  const { room } = await openLoopbackRoom({
    clock: adapters.clock,
    timers: adapters.timers,
    createId: adapters.createId,
    topic: `standalone-${seed}`,
    module: gameRoomModule,
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
  test('syncs at a tally of 0, then adds one', async () => {
    const { room, settle } = await openStandalone('standalone-1');
    expect(readTally(room.getSnapshot())).toBe(0);
    room.dispatch(AddOne({}) as never);
    await settle(() => room.getPendingQueueIds().length === 0);
    expect(readTally(room.getSnapshot())).toBe(1);
    room.destroy();
  });

  test('refuses an unknown command before queueing it', async () => {
    const { room, errors, settle } = await openStandalone('standalone-2');
    room.dispatch({
      type: asKeyword('game-room-cmd/bogus'),
      payload: {},
    } as never);
    await settle(() => errors.length > 0);
    expect(errors).toEqual([
      expect.objectContaining({ type: ROOM_ERROR_TYPE.invalidCommand }),
    ]);
    expect(room.getPendingQueueIds()).toEqual([]);
    expect(readTally(room.getSnapshot())).toBe(0);
    room.destroy();
  });
});
