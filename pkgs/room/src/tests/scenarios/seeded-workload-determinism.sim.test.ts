import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
  dispatch,
  hold,
  passTime,
  release,
  scriptRoom,
  serverHash,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { Increment } from '../fixtures/counter-module';

async function runWorkload(seed: number | string): Promise<string> {
  await using run = await scriptRoom(counterSystem, { seed });
  await run.apply(addClient, { id: 'alice' });
  await run.apply(addClient, { id: 'bob' });
  for (let i = 0; i < 7; i += 1) {
    await run.apply(dispatch, {
      clientId: i % 2 === 0 ? 'alice' : 'bob',
      payload: Increment({}),
    });
  }
  await run.apply(hold, 'bob');
  await run.apply(dispatch, {
    clientId: 'alice',
    payload: Increment({}),
  });
  await run.apply(release, 'bob');
  await run.apply(passTime, 0);
  await expectConverged(run);
  const h = await run.observe(serverHash);
  const hashes = (await run.observe(clientHash)) as Record<string, string>;
  return `${h}:${hashes['alice']}:${hashes['bob']}`;
}

describe('room sim: seeded workload determinism', () => {
  test('same seed yields identical multi-client hash twice', async () => {
    const seed = process.env['SIM_SEED'] ?? '42';
    const once = await runWorkload(seed);
    const twice = await runWorkload(seed);
    expect(once).toBe(twice);
  });
});
