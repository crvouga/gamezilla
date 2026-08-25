import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';

import { openRoomSimWorld } from '../../sim/world';
import {
  Decrement,
  Increment,
  TestCounterModule,
} from '../fixtures/counter-module';

async function runShortChaos(seed: string, steps: number): Promise<string> {
  await using world = await openRoomSimWorld({
    seed,
    module: TestCounterModule,
  });
  const alice = await world.addClient({ id: 'alice' });
  const bob = await world.addClient({ id: 'bob' });
  const clients = [alice, bob];
  const rng = world.rng.fork('chaos');

  for (let step = 0; step < steps; step += 1) {
    const actor = clients[rng.int(clients.length)]!;
    const roll = rng.random();
    if (roll < 0.2) {
      using _h = world.net(actor.id).set('hold');
      actor.dispatch(Increment({}));
      await world.drain();
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
  return `${await world.serverHash()}:${alice.hash()}:${bob.hash()}`;
}

describe('room long-chaos PBT', () => {
  test('same generated seed → identical chaos fingerprint', async () => {
    await assertProperty(
      'room chaos determinism',
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10_000 }).map(String),
        fc.integer({ min: 4, max: 12 }),
        async (seed, steps) => {
          const once = await runShortChaos(seed, steps);
          const twice = await runShortChaos(seed, steps);
          expect(once).toBe(twice);
        }
      ),
      { numRuns: 4 }
    );
  }, 120_000);
});
