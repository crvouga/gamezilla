import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';
import { commandWire } from './wire-helpers';

describe('room sim: session take-over (E-C04)', () => {
  test('take-over mid-command does not double-apply', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.system);
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
