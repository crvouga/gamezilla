import { describe, expect, test } from 'bun:test';
import { openWorld } from '../../sim/world';
import {
  counterValue,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';
import { commandWire } from './wire-helpers';

describe('room sim: session take-over (E-C04)', () => {
  test('take-over mid-command does not double-apply', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? '42',
      module: TestCounterModule,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    const commandId = 'takeover-cmd';
    const frame = commandWire({
      id: commandId,
      ts: world.clock.now(),
      payload: Increment({}),
    });
    a.injectToServer(frame, { direct: true });
    await world.drain();

    await world.node('alice').takeOver();
    a.injectToServer(frame, { direct: true });
    a.dispatch(Increment({}));
    await world.assertConverged();

    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(2);
    expect(counterValue(a.snapshot())).toBe(2);
    expect(counterValue(b.snapshot())).toBe(2);
    expect(a.hash()).toBe(await world.serverHash());
    expect(world.server.getRoster()).toHaveLength(2);
  });
});
