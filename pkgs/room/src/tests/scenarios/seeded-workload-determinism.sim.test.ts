import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
  dispatch,
  hold,
  release,
  serverHash,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { Increment } from '../fixtures/counter-module';

async function runWorkload(seed: number | string): Promise<string> {
  await using s = await counterSystem.script({ seed });
  await s.apply(addClient, { id: 'alice' });
  await s.apply(addClient, { id: 'bob' });
  for (let i = 0; i < 7; i += 1) {
    await s.apply(dispatch, {
      clientId: i % 2 === 0 ? 'alice' : 'bob',
      payload: Increment({}),
    });
  }
  await s.apply(hold, 'bob');
  await s.apply(dispatch, {
    clientId: 'alice',
    payload: Increment({}),
  });
  await s.apply(release, 'bob');
  await s.elapse(0);
  await expectConverged(s);
  const h = await s.observe(serverHash);
  const hashes = (await s.observe(clientHash)) as Record<string, string>;
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
