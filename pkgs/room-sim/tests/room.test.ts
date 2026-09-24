import { describe, expect, it } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import {
  ROOM_ERROR_TYPE,
  type RoomClient,
  type RoomCommandPayload,
  type RoomEvent,
  RoomMetaAttr,
  type RoomState,
} from '@pkgs/room';
import { Increment, openLoopbackRoom, TestCounterModule } from '@pkgs/room-sim';
import { createSimAdapters, type SimAdapters } from '@pkgs/uuid';

const SETTLE_STEPS = 200;

/** Flush loopback IO and step virtual time until `pred` holds (bounded). */
async function settle<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
>(
  sim: SimAdapters,
  room: RoomClient<S, C, E, string>,
  pred: () => boolean
): Promise<void> {
  for (let step = 0; step < SETTLE_STEPS; step += 1) {
    await room.flushIo();
    await Promise.resolve();
    if (pred()) return;
    sim.clock.advance(1);
  }
  throw new Error(`settle: condition not met by t=${sim.clock.now()}ms`);
}

describe('server-authoritative room (loopback)', () => {
  it('staysInSync after welcome + increment', async () => {
    const sim = createSimAdapters({ seed: 1 });
    const { room } = await openLoopbackRoom({
      clock: sim.clock,
      timers: sim.timers,
      createId: sim.createId,
      topic: 't-inc',
      module: TestCounterModule,
    });
    await settle(sim, room, () =>
      RoomMetaAttr.isSynced.from(room.getSnapshot())
    );
    const k = asKeyword('counter/count');
    expect(room.getSnapshot()[k]).toBe(0);
    room.dispatch(Increment({}));
    await settle(sim, room, () => room.getPendingQueueIds().length === 0);
    expect(room.getSnapshot()[k]).toBe(1);
    room.destroy();
  });

  it('local validation rejects unknown command before queue', async () => {
    const sim = createSimAdapters({ seed: 2 });
    const errs: unknown[] = [];
    const { room } = await openLoopbackRoom({
      clock: sim.clock,
      timers: sim.timers,
      createId: sim.createId,
      topic: 't-local-err',
      module: TestCounterModule,
      onError: (e) => {
        errs.push(e);
      },
    });
    await settle(sim, room, () =>
      RoomMetaAttr.isSynced.from(room.getSnapshot())
    );
    room.dispatch({
      type: asKeyword('space-counter-cmd/bogus'),
      payload: {},
    } as never);
    await settle(sim, room, () => errs.length > 0);
    expect(errs.length).toBe(1);
    expect((errs[0] as { type: string }).type).toBe(
      ROOM_ERROR_TYPE.invalidCommand
    );
    expect(room.getPendingQueueIds()).toEqual([]);
    room.destroy();
  });
});
