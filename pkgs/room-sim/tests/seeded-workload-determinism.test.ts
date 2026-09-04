import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
  counterSystem,
  dispatch,
  expectInSync,
  Increment,
  pauseNetwork,
  resumeNetwork,
  serverHash,
} from '@pkgs/room-sim';

async function runWorkload(seed: number | string): Promise<string> {
  await using s = await counterSystem.run({ seed });
  await s.apply(addClient, { id: 'alice' });
  await s.apply(addClient, { id: 'bob' });
  for (let i = 0; i < 7; i += 1) {
    await s.apply(dispatch, {
      clientId: i % 2 === 0 ? 'alice' : 'bob',
      payload: Increment({}),
    });
  }
  await s.apply(pauseNetwork, 'bob');
  await s.apply(dispatch, {
    clientId: 'alice',
    payload: Increment({}),
  });
  await s.apply(resumeNetwork, 'bob');
  await s.advanceTime(0);
  await expectInSync(s);
  const h = await s.read(serverHash);
  const hashes = (await s.read(clientHash)) as Record<string, string>;
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
