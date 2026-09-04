import { describe, expect, test } from 'bun:test';
import { defineSystem } from '@pkgs/dst';
import { InMemoryRoomStorage } from '../../server/adapters/memory';
import {
  addClient,
  bootRoomSurface,
  dispatch,
  hold,
  ROOM_ARGS,
  type RoomArgs,
  type RoomSurface,
  registerRoomLibrary,
  release,
  roomVirtual,
} from '../../sim/scenario';
import { counterApp } from '../apps/counter/app';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

/** Counter system pinned to one topic on a storage shared across systems. */
function topicSystem(topic: string, storage: InMemoryRoomStorage) {
  const system = defineSystem<RoomSurface, RoomArgs>({
    name: `room.${topic}`,
    args: ROOM_ARGS,
    create: (session, args) =>
      bootRoomSurface(session, counterApp, args, { topic, storage }),
  });
  system.host({ default: true, name: 'virtual', create: roomVirtual });
  registerRoomLibrary(system, counterApp);
  return system;
}

describe('room sim: two-topic shared storage (E-H01)', () => {
  test('faults on topic A do not affect topic B', async () => {
    const storage = new InMemoryRoomStorage();
    await using sA = await topicSystem('topic-a', storage).script({ seed: 42 });
    await using sB = await topicSystem('topic-b', storage).script({ seed: 43 });
    await sA.apply(addClient, { id: 'alice' });
    await sA.apply(addClient, { id: 'bob' });
    await sB.apply(addClient, { id: 'carol' });
    await expectConverged(sA);
    await expectConverged(sB);

    await sA.apply(hold, 'bob');
    await sA.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await sA.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await sB.apply(dispatch, {
      clientId: 'carol',
      payload: Increment({}),
    });
    expect(counterValue(await readClient(sA, 'bob'))).toBe(0);
    expect(counterValue(await readClient(sB, 'carol'))).toBe(1);
    await sA.apply(release, 'bob');
    await sA.elapse(0);

    await expectConverged(sA);
    await expectConverged(sB);
    expect(counterValue(await readServer(sA))).toBe(2);
    expect(counterValue(await readClient(sA, 'alice'))).toBe(2);
    await expectHashMatch(sA, 'alice');
    expect(counterValue(await readServer(sB))).toBe(1);
    expect(counterValue(await readClient(sB, 'carol'))).toBe(1);
    await expectHashMatch(sB, 'carol');
    expect(await storage.getLastSeq('topic-a')).toBe(2);
    expect(await storage.getLastSeq('topic-b')).toBe(1);
  });
});
