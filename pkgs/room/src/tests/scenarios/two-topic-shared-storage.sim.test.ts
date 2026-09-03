import { describe, expect, test } from 'bun:test';
import { InMemoryRoomStorage } from '../../server/adapters/memory';
import {
  addClient,
  defineRoomSystem,
  dispatch,
  hold,
  release,
} from '../../sim/scenario';
import { openRoom } from '../scenario/open-room';
import { counterApp } from '../apps/counter/app';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: two-topic shared storage (E-H01)', () => {
  test('faults on topic A do not affect topic B', async () => {
    const storage = new InMemoryRoomStorage();
    const systemA = defineRoomSystem(counterApp, {
      name: 'room.topic-a',
      topic: 'topic-a',
      storage,
    });
    const systemB = defineRoomSystem(counterApp, {
      name: 'room.topic-b',
      topic: 'topic-b',
      storage,
    });
    await using runA = await openRoom(systemA);
    await using runB = await openRoom(systemB, { seed: '43' });
    await runA.apply(addClient, { id: 'alice' });
    await runA.apply(addClient, { id: 'bob' });
    await runB.apply(addClient, { id: 'carol' });
    await expectConverged(runA);
    await expectConverged(runB);

    await runA.apply(hold, 'bob');
    await runA.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await runA.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await runB.apply(dispatch, {
      clientId: 'carol',
      payload: Increment({}),
    });
    expect(counterValue(await readClient(runA, 'bob'))).toBe(0);
    expect(counterValue(await readClient(runB, 'carol'))).toBe(1);
    await runA.apply(release, 'bob');
    await runA.elapse(0);

    await expectConverged(runA);
    await expectConverged(runB);
    expect(counterValue(await readServer(runA))).toBe(2);
    expect(counterValue(await readClient(runA, 'alice'))).toBe(2);
    await expectHashMatch(runA, 'alice');
    expect(counterValue(await readServer(runB))).toBe(1);
    expect(counterValue(await readClient(runB, 'carol'))).toBe(1);
    await expectHashMatch(runB, 'carol');
    expect(await storage.getLastSeq('topic-a')).toBe(2);
    expect(await storage.getLastSeq('topic-b')).toBe(1);
  });
});
