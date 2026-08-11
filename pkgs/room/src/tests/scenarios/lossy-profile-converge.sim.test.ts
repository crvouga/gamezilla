import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: lossy profile converge (E-A04)', () => {
  test('mild faults + reorder/dup still converge after soft cycle', async () => {
    await using world = await openRoomSimWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
      mildFaults: true,
    });
    const clients = [
      await world.addClient({ id: 'alice' }),
      await world.addClient({ id: 'bob' }),
      await world.addClient({ id: 'carol' }),
    ];
    await world.assertConverged();

    {
      using _f = world.net('bob').set({
        oneWayDelayMeanMs: 3,
        oneWayDelayJitterMs: 4,
        packetLossProbability: 0.05,
        reorderProbability: 0.2,
        duplicateProbability: 0.1,
      });
      for (let i = 0; i < 10; i += 1) {
        clients[i % 3]!.dispatch(Increment({}));
        await world.drain();
      }
    }

    for (const c of clients) {
      await c.disconnect();
      await c.connect();
    }
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(10);
    const serverHash = await world.serverHash();
    for (const c of clients) {
      expect(counterValue(c.snapshot())).toBe(10);
      expect(c.hash()).toBe(serverHash);
    }
  });
});
