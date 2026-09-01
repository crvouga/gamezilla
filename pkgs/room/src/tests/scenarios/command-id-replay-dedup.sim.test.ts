import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';
import { commandWire } from './wire-helpers';

describe('room sim: command-id replay dedup (E-B02)', () => {
  test('same commandId applies once across reconnect storm', async () => {
    await using host = await openWorld(counterSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = host.facade;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    const commandId = 'fixed-cmd-1';
    const frame = commandWire({
      id: commandId,
      ts: world.clock.now(),
      payload: Increment({}),
    });
    a.injectToServer(frame, { direct: true });
    await world.drain();
    expect(counterValue(a.snapshot())).toBe(1);

    for (let i = 0; i < 5; i += 1) {
      a.injectToServer(frame, { direct: true });
      await world.drain();
    }
    await world.node('alice').takeOver();
    a.injectToServer(frame, { direct: true });
    await world.drain();

    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(1);
    expect(counterValue(a.snapshot())).toBe(1);
    expect(counterValue(b.snapshot())).toBe(1);
    expect(a.hash()).toBe(await world.serverHash());
    expect(await world.storage.getLastSeq(world.topic)).toBe(1);
  });
});
