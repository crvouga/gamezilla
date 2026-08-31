import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

describe('room sim: spectator fanout (E-H03)', () => {
  test('joining spectators does not change domain hash', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    a.dispatch(Increment({}));
    await world.drain();
    const domainHash = a.hash();

    await world.addClient({ id: 'spec1' });
    await world.addClient({ id: 'spec2' });
    await world.assertConverged();

    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
    expect(a.hash()).toBe(domainHash);
    expect(world.server.getRoster()).toHaveLength(3);
  });
});
