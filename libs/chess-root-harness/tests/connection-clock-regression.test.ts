import { expect, test } from 'bun:test';
import { multiplayerClockSeconds } from '@libs/chess-matchmaking-harness/multiplayer-availability';
import { givenMultiplayerClock } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import {
  CLOCK_OBSERVERS,
  prepareSharedClockGame,
  sharedClockGame,
} from '@libs/chess-root-harness/shared-clock-model';
import { cutConnection } from '@libs/harness/platform';
import { openHarness } from './open-chess-harness';

test('cutting a connection does not silently spend one second of an agreed game', async () => {
  // regression: cutting-connection-spends-game-time
  await using s = await openHarness('cutting-connection-spends-game-time');
  await s.apply(prepareSharedClockGame, 'blitz');
  const game = await s.read(sharedClockGame);
  await s.apply(givenMultiplayerClock, 'alice', {
    gameId: game.id,
    side: 'white',
    ms: 40_000,
  });
  await cutConnection({ s }, 'alice');
  expect(
    (await s.read(multiplayerClockSeconds, CLOCK_OBSERVERS.alice)).white
  ).toBe(40);
  await s.advanceTime(20_000);
  expect(
    (await s.read(multiplayerClockSeconds, CLOCK_OBSERVERS.alice)).white
  ).toBe(20);
}, 120_000);
