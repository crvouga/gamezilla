/**
 * Framework contract: a room run is a function of its seed. The same seeded
 * workload, run twice, ends with identical room and device hashes.
 */

import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
  counterSystem,
  dispatch,
  expectInSync,
  Increment,
  Move,
  matchClockSystem,
  pauseNetwork,
  resumeNetwork,
  roomEpoch,
  StartMatch,
  serverHash,
} from '@pkgs/room-sim';

/** Alice and Bob trade increments, Bob misses one while paused, then all settle. */
async function counterWorkload(seed: string): Promise<string> {
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
  await s.apply(dispatch, { clientId: 'alice', payload: Increment({}) });
  await s.apply(resumeNetwork, 'bob');
  await s.advanceTime(0);
  await expectInSync(s);
  const hashes = await s.read(clientHash);
  return `${await s.read(serverHash)}:${hashes['alice']}:${hashes['bob']}`;
}

/** Both sides move once, then the clock runs out. */
async function clockWorkload(seed: string): Promise<string> {
  await using s = await matchClockSystem.run({
    seed,
    runtime: roomEpoch(60_000),
  });
  await s.apply(addClient, { id: 'white', identity: 'white' });
  await s.apply(addClient, { id: 'black', identity: 'black' });
  await expectInSync(s);
  await s.apply(dispatch, {
    clientId: 'white',
    payload: StartMatch({ whiteMs: 100, blackMs: 100 }),
  });
  await s.advanceTime(20);
  await s.apply(dispatch, { clientId: 'white', payload: Move({}) });
  await s.advanceTime(15);
  await s.apply(dispatch, { clientId: 'black', payload: Move({}) });
  await s.advanceTime(200);
  await expectInSync(s);
  const hashes = await s.read(clientHash);
  return `${await s.read(serverHash)}:${hashes['white']}:${hashes['black']}`;
}

describe('room sim: seeded determinism', () => {
  test('a counter workload replays to identical hashes', async () => {
    const seed = process.env['SIM_SEED'] ?? '42';
    expect(await counterWorkload(seed)).toBe(await counterWorkload(seed));
  });

  test('a match-clock workload replays to identical hashes', async () => {
    const seed = process.env['SIM_SEED'] ?? 'mc-06';
    expect(await clockWorkload(seed)).toBe(await clockWorkload(seed));
  });
});
