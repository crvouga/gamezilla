import { expect, test } from 'bun:test';
import { multiplayerClockSeconds } from '@libs/chess-matchmaking-harness/multiplayer-availability';
import { prepareMultiplayerSpaceModel } from '@libs/chess-root-harness/multiplayer-space-model';
import {
  CLOCK_OBSERVERS,
  prepareSharedClockGame,
  sharedClockGame,
} from '@libs/chess-root-harness/shared-clock-model';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness/multiplayer-commands';
import { givenMultiplayerClock } from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
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

test('cutting the connection refuses an offered draw without waiting for a server answer', async () => {
  // regression: offline-connection-keeps-sync-online
  await using s = await openHarness('offline-connection-keeps-sync-online');
  await s.apply(prepareMultiplayerSpaceModel, '5+0');
  const game = (await s.read(multiplayerView, 'alice')).game;
  if (game === null) throw new Error('The agreed game is missing');
  await s.apply(sendMultiplayerCommand, 'bob', {
    name: 'offerMultiplayerDraw',
    args: { gameId: game.id, requestId: 'offered-draw' },
  });
  await cutConnection({ s }, 'alice');
  await s.apply(sendMultiplayerCommand, 'alice', {
    name: 'acceptMultiplayerDraw',
    args: { gameId: game.id, requestId: 'offline-draw-acceptance' },
  });
  const reply = await s.read(multiplayerCommandReply, 'alice');
  expect(reply?.result.ok).toBe(false);
  expect(reply?.result.ok === false && reply.result.failures[0]?.code).toBe(
    'OFFLINE'
  );
}, 120_000);
