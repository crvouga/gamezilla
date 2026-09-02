import { describe, expect, test } from 'bun:test';

import { openWorld } from '@pkgs/determinism';
import { counterSystem } from '../apps/counter/system';
import { counterValue, Increment } from '../fixtures/counter-module';

describe('room sim: client/server crash restart', () => {
  test('client crash keeps local queue; restart + settle converges', async () => {
    await using host = await openWorld(counterSystem, {
      seed: 'crash-client-1',
      knobs: { clientCount: 0 },
    });
    const world = host;
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    await a.disconnect();
    a.dispatch(Increment({}));
    await world.node('alice').crash();
    expect(a.isCrashed()).toBe(true);

    b.dispatch(Increment({}));
    await world.drain();

    await world.node('alice').restart();
    await world.assertConverged();
    const server = await world.serverSnapshot();
    expect(counterValue(server)).toBe(2);
    expect(counterValue(a.snapshot())).toBe(2);
    expect(a.hash()).toBe(await world.serverHash());
  });

  test('server crash + restart hydrates log and converges', async () => {
    await using host = await openWorld(counterSystem, {
      seed: 'crash-server-1',
      knobs: { clientCount: 0 },
    });
    const world = host;
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });
    a.dispatch(Increment({}));
    a.dispatch(Increment({}));
    await world.drain();
    expect(counterValue(await world.serverSnapshot())).toBe(2);

    await world.serverCrash();
    expect(world.isServerCrashed()).toBe(true);
    await world.serverRestart();
    expect(world.isServerCrashed()).toBe(false);
    expect(counterValue(await world.serverSnapshot())).toBe(2);

    await world.assertConverged();
    expect(a.hash()).toBe(await world.serverHash());
  });

  test('boundary afterNextCommitted crashes client; settle restores', async () => {
    await using host = await openWorld(counterSystem, {
      seed: 'boundary-committed-1',
      knobs: { clientCount: 0 },
    });
    const world = host;
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });
    world.armCrashAt('alice', 'afterNextCommitted');
    a.dispatch(Increment({}));
    await world.drain();
    // Arm may fire asynchronously with delivery; settle heals either way.
    await world.assertConverged();
    expect(counterValue(await world.serverSnapshot())).toBe(1);
  });

  test('checkInvariants passes on healthy world', async () => {
    await using host = await openWorld(counterSystem, {
      seed: 'inv-1',
      knobs: { clientCount: 0 },
    });
    const world = host;
    const a = await world.addClient({ id: 'alice' });
    a.dispatch(Increment({}));
    await world.drain();
    await world.checkInvariants();
  });
});
