import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';
import { commandWire } from './wire-helpers';

describe('room sim: replay flood dedup (E-D01)', () => {
  test('N replays of one commandId mutate once', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.assertConverged();

    const commandId = 'flood-1';
    const frame = commandWire({
      id: commandId,
      ts: world.clock.now(),
      payload: Increment({}),
    });
    for (let i = 0; i < 50; i += 1) {
      a.injectToServer(frame, { direct: true });
    }
    await world.drain();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
    expect(await world.storage.getLastSeq(world.topic)).toBe(1);
  });
});
