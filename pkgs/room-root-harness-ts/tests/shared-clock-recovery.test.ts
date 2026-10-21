import { expect, test } from 'bun:test';
import {
  readClocksPaused,
  readTimeLeftSeconds,
  StartMatch,
} from '@pkgs/room-root-harness-ts/game-room';
import { clock } from '@pkgs/room-root-harness-ts/observations';
import { readServer } from '@pkgs/room-root-harness-ts/read-state';
import {
  addClient,
  serverRestart,
} from '@pkgs/room-root-harness-ts/room-actions';
import { exampleSystem } from '@pkgs/room-root-harness-ts/system';
import { interruptedMatchChoice } from './interrupted-match';

// regression: room-clock-charges-shared-outage
test('an accepted start keeps all four seconds across a two-second shared outage', async () => {
  await using s = await exampleSystem.run({
    seed: 'room-clock-charges-shared-outage',
  });
  for (const person of ['white', 'black'])
    await s.apply(addClient, { id: person, identity: person });
  await interruptedMatchChoice(
    s,
    'white',
    StartMatch({ whiteMs: 4000, blackMs: 4000 })
  );
  await s.advanceTime(2000);
  expect(readClocksPaused(await readServer(s))).toBe(true);
  await s.apply(serverRestart);
  const state = await readServer(s);
  const now = await s.read(clock);
  expect(readClocksPaused(state)).toBe(false);
  expect(readTimeLeftSeconds(state, 'white', now)).toBe(4);
  expect(readTimeLeftSeconds(state, 'black', now)).toBe(4);
});
