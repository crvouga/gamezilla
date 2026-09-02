import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { counterSystem } from '../apps/counter/system';
import { Decrement, Increment } from '../fixtures/counter-module';

async function runChaos(seed: string): Promise<string> {
  await using host = await openWorld(counterSystem, {
    seed,
    knobs: { clientCount: 0 },
  });
  const world = host;
  const alice = await world.addClient({ id: 'alice' });
  const bob = await world.addClient({ id: 'bob' });
  const carol = await world.addClient({ id: 'carol' });
  const clients = [alice, bob, carol];
  const rng = world.rng.fork('chaos');

  for (let step = 0; step < 40; step += 1) {
    const actor = clients[rng.int(clients.length)]!;
    const roll = rng.random();
    if (roll < 0.15) {
      using _h = world.net(actor.id).set('hold');
      actor.dispatch(Increment({}));
      await world.drain();
    } else if (roll < 0.25) {
      // Down drops the wire frame; soft-cycle so the durable queue re-flushes.
      {
        using _d = world.net(actor.id).set('down');
        actor.dispatch(Decrement({}));
        await world.drain();
      }
      await actor.disconnect();
      await actor.connect();
    } else if (roll < 0.35) {
      await actor.disconnect();
      actor.dispatch(Increment({}));
      await actor.connect();
    } else if (roll < 0.5) {
      actor.dispatch(Decrement({}));
    } else {
      actor.dispatch(Increment({}));
    }
    await world.drain();
  }

  for (const c of clients) {
    await c.disconnect();
    await c.connect();
  }
  await world.assertConverged();
  return `${await world.serverHash()}:${alice.hash()}:${bob.hash()}:${carol.hash()}`;
}

describe('room sim: long chaos determinism (E-E01)', () => {
  test('same seed → identical triple hash twice', async () => {
    const seed = process.env['SIM_SEED'] ?? '42';
    const once = await runChaos(seed);
    const twice = await runChaos(seed);
    expect(once).toBe(twice);
  });
});
