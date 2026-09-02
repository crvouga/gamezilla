import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { InMemoryRoomStorage } from '../../server/adapters/memory';
import { defineRoomSystem } from '../../sim/system';
import { counterApp } from '../apps/counter/app';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: two-topic shared storage (E-H01)', () => {
  test('faults on topic A do not affect topic B', async () => {
    const storage = new InMemoryRoomStorage();
    const systemA = defineRoomSystem(counterApp, {
      id: 'room.topic-a',
      topic: 'topic-a',
      storage,
    });
    const systemB = defineRoomSystem(counterApp, {
      id: 'room.topic-b',
      topic: 'topic-b',
      storage,
    });
    await using hostA = await openWorld(systemA, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    await using hostB = await openWorld(systemB, {
      seed: '43',
      knobs: { clientCount: 0 },
    });
    const worldA = hostA;
    const worldB = hostB;

    const a1 = await worldA.addClient({ id: 'alice' });
    const a2 = await worldA.addClient({ id: 'bob' });
    const b1 = await worldB.addClient({ id: 'carol' });
    await worldA.assertConverged();
    await worldB.assertConverged();

    {
      using _h = worldA.net('bob').set('hold');
      a1.dispatch(Increment({}));
      a1.dispatch(Increment({}));
      await worldA.drain();
      b1.dispatch(Increment({}));
      await worldB.drain();
      expect(counterValue(a2.snapshot())).toBe(0);
      expect(counterValue(b1.snapshot())).toBe(1);
    }

    await worldA.assertConverged();
    await worldB.assertConverged();
    const serverA = await worldA.serverSnapshot();
    expect(counterValue(serverA)).toBe(2);
    expect(counterValue(a1.snapshot())).toBe(2);
    expect(a1.hash()).toBe(await worldA.serverHash());
    const serverB = await worldB.serverSnapshot();
    expect(counterValue(serverB)).toBe(1);
    expect(counterValue(b1.snapshot())).toBe(1);
    expect(b1.hash()).toBe(await worldB.serverHash());
    expect(await storage.getLastSeq('topic-a')).toBe(2);
    expect(await storage.getLastSeq('topic-b')).toBe(1);
  });
});
