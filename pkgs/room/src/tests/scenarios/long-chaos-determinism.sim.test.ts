import { describe, expect, test } from 'bun:test';
import { createSeededRng } from '@pkgs/uuid';
import {
  addClient,
  clientHash,
  connect,
  disconnect,
  dispatch,
  down,
  hold,
  release,
  seed as seedOf,
  serverHash,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { Decrement, Increment } from '../fixtures/counter-module';

async function runChaos(seed: string): Promise<string> {
  await using s = await counterSystem.script({ seed });
  await s.apply(addClient, { id: 'alice' });
  await s.apply(addClient, { id: 'bob' });
  await s.apply(addClient, { id: 'carol' });
  const ids = ['alice', 'bob', 'carol'] as const;
  const rng = createSeededRng(await s.observe(seedOf)).fork('chaos');

  for (let step = 0; step < 40; step += 1) {
    const actor = ids[rng.int(ids.length)]!;
    const roll = rng.random();
    if (roll < 0.15) {
      await s.apply(hold, actor);
      await s.apply(dispatch, {
        clientId: actor,
        payload: Increment({}),
      });
      await s.apply(release, actor);
    } else if (roll < 0.25) {
      await s.apply(down, actor);
      await s.apply(dispatch, {
        clientId: actor,
        payload: Decrement({}),
      });
      await s.apply(release, actor);
      await s.apply(disconnect, actor);
      await s.apply(connect, actor);
    } else if (roll < 0.35) {
      await s.apply(disconnect, actor);
      await s.apply(dispatch, {
        clientId: actor,
        payload: Increment({}),
      });
      await s.apply(connect, actor);
    } else if (roll < 0.5) {
      await s.apply(dispatch, {
        clientId: actor,
        payload: Decrement({}),
      });
    } else {
      await s.apply(dispatch, {
        clientId: actor,
        payload: Increment({}),
      });
    }
    await s.elapse(0);
  }

  for (const id of ids) {
    await s.apply(disconnect, id);
    await s.apply(connect, id);
  }
  await expectConverged(s);
  const h = await s.observe(serverHash);
  const hashes = (await s.observe(clientHash)) as Record<string, string>;
  return `${h}:${hashes['alice']}:${hashes['bob']}:${hashes['carol']}`;
}

describe('room sim: long chaos determinism (E-E01)', () => {
  test('same seed → identical triple hash twice', async () => {
    const seed = process.env['SIM_SEED'] ?? '42';
    const once = await runChaos(seed);
    const twice = await runChaos(seed);
    expect(once).toBe(twice);
  });
});
