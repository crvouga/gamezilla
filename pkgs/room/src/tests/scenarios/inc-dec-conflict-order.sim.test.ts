import { describe, expect, test } from 'bun:test';
import { openRoomSimWorld } from '../../sim/world';
import {
  counterValue,
  Decrement,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: inc-dec conflict order (E-B04)', () => {
  test('final count matches server fold under jitter', async () => {
    await using world = await openRoomSimWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    {
      using _j = world.net('alice').set({
        oneWayDelayMeanMs: 5,
        oneWayDelayJitterMs: 8,
        packetLossProbability: 0,
      });
      using _j2 = world.net('bob').set({
        oneWayDelayMeanMs: 5,
        oneWayDelayJitterMs: 8,
        packetLossProbability: 0,
      });
      for (let i = 0; i < 6; i += 1) {
        a.dispatch(Increment({}));
        b.dispatch(Decrement({}));
      }
      await world.drain();
    }

    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(0);
    expect(counterValue(a.snapshot())).toBe(0);
    expect(a.hash()).toBe(await world.serverHash());
    expect(b.hash()).toBe(await world.serverHash());
  });
});
