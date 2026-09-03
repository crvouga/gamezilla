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
import { openRoom } from '../scenario/open-room';

async function runChaos(seed: string): Promise<string> {
  await using run = await openRoom(counterSystem, { seed });
  await run.apply(addClient, { id: 'alice' });
  await run.apply(addClient, { id: 'bob' });
  await run.apply(addClient, { id: 'carol' });
  const ids = ['alice', 'bob', 'carol'] as const;
  const rng = createSeededRng(await run.observe(seedOf)).fork('chaos');

  for (let step = 0; step < 40; step += 1) {
    const actor = ids[rng.int(ids.length)]!;
    const roll = rng.random();
    if (roll < 0.15) {
      await run.apply(hold, actor);
      await run.apply(dispatch, {
        clientId: actor,
        payload: Increment({}),
      });
      await run.apply(release, actor);
    } else if (roll < 0.25) {
      await run.apply(down, actor);
      await run.apply(dispatch, {
        clientId: actor,
        payload: Decrement({}),
      });
      await run.apply(release, actor);
      await run.apply(disconnect, actor);
      await run.apply(connect, actor);
    } else if (roll < 0.35) {
      await run.apply(disconnect, actor);
      await run.apply(dispatch, {
        clientId: actor,
        payload: Increment({}),
      });
      await run.apply(connect, actor);
    } else if (roll < 0.5) {
      await run.apply(dispatch, {
        clientId: actor,
        payload: Decrement({}),
      });
    } else {
      await run.apply(dispatch, {
        clientId: actor,
        payload: Increment({}),
      });
    }
    await run.elapse(0);
  }

  for (const id of ids) {
    await run.apply(disconnect, id);
    await run.apply(connect, id);
  }
  await expectConverged(run);
  const h = await run.observe(serverHash);
  const hashes = (await run.observe(clientHash)) as Record<string, string>;
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
