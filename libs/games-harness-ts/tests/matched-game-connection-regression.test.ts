/**
 * Cutting a device's connection in a matched game, for every game offering
 * finding an opponent: it spends no time of the agreed game, and an
 * opening move or a draw accepted with no connection is refused at once,
 * leaving the last known board as it was.
 */

import { describe, expect, test } from 'bun:test';
import { givenMultiplayerClock } from '@libs/game-matchmaking-harness-ts/matched-game-fixtures';
import { multiplayerClockSeconds } from '@libs/game-matchmaking-harness-ts/multiplayer-availability';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { cutConnection } from '@libs/harness-ts/platform';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { openConformanceHarness, turnGamesHeldTo } from './conformance-world';
import {
  CLOCK_OBSERVERS,
  prepareSharedClockGame,
} from './quint/matched-game-clock-recovery-world';
import {
  prepareMatchedSpaces,
  spacesMatch,
} from './quint/matched-game-spaces-world';

const SPEC_URI = 'specs/games/matched-game-clock-recovery.qnt';

/** A run of the clock-recovery model's world for `game`, outside a trace. */
function runFor(
  s: OpenHarness,
  game: TurnHarnessGame,
  id: string
): QuintHarnessWorld {
  return {
    s,
    quiet: s,
    memo: new Map(),
    calls: [],
    ctx: {
      packageName: '@libs/games-harness-ts',
      specUri: SPEC_URI,
      model: 'matched-game-clock-recovery',
      trace: 1,
      seed: '0x67932',
      testId: `${id}.${game.shared.id}`,
      title: `${id} [${game.label}]`,
      variant: { id: game.shared.id, label: game.label },
    },
  };
}

describe.each(
  turnGamesHeldTo(SPEC_URI).map((game) => [game.label, game] as const)
)('%s', (_label, game) => {
  test('cutting a connection does not silently spend one second of an agreed game', async () => {
    // regression: cutting-connection-spends-game-time
    const id = 'cutting-connection-spends-game-time';
    await using s = await openConformanceHarness(`${id}-${game.shared.id}`);
    const w = runFor(s, game, id);
    await prepareSharedClockGame(w, 'blitz');
    const played = await spacesMatch(w);
    await s.apply(givenMultiplayerClock, 'alice', {
      gameId: played.id,
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

  test('an offline first side keeps its accepted board and is refused its opening move, with no move deferred', async () => {
    // regression: chess-offline-connection-state
    // regression: github-chess-harness-default-timeout
    const id = 'offline-first-side-opening';
    await using s = await openConformanceHarness(`${id}-${game.shared.id}`);
    await prepareMatchedSpaces(runFor(s, game, id), '5+0');
    const played = (await s.read(multiplayerView, 'alice')).game;
    if (played === null) throw new Error('The agreed game is missing');
    await cutConnection({ s }, 'alice');
    await s.apply(sendMultiplayerCommand, 'alice', {
      name: 'playMultiplayerMove',
      args: {
        gameId: played.id,
        revision: 0,
        uci: game.fixtures.firstSideVictory[0],
        requestId: 'offline-opening',
      },
    });
    const reply = await s.read(multiplayerCommandReply, 'alice');
    expect(reply?.result.ok).toBe(false);
    expect(reply?.result.ok === false && reply.result.failures[0]?.code).toBe(
      'OFFLINE'
    );
    expect((await s.read(multiplayerView, 'alice')).game).toEqual(played);
  }, 120_000);

  test('cutting the connection refuses an offered draw without waiting for a server answer', async () => {
    // regression: offline-connection-keeps-sync-online
    const id = 'offline-connection-keeps-sync-online';
    await using s = await openConformanceHarness(`${id}-${game.shared.id}`);
    await prepareMatchedSpaces(runFor(s, game, id), '5+0');
    const played = (await s.read(multiplayerView, 'alice')).game;
    if (played === null) throw new Error('The agreed game is missing');
    await s.apply(sendMultiplayerCommand, 'bob', {
      name: 'offerMultiplayerDraw',
      args: { gameId: played.id, requestId: 'offered-draw' },
    });
    await cutConnection({ s }, 'alice');
    await s.apply(sendMultiplayerCommand, 'alice', {
      name: 'acceptMultiplayerDraw',
      args: { gameId: played.id, requestId: 'offline-draw-acceptance' },
    });
    const reply = await s.read(multiplayerCommandReply, 'alice');
    expect(reply?.result.ok).toBe(false);
    expect(reply?.result.ok === false && reply.result.failures[0]?.code).toBe(
      'OFFLINE'
    );
  }, 120_000);
});
