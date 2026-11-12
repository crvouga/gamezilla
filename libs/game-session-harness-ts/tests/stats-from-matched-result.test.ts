import { describe, expect, test } from 'bun:test';
import { MULTIPLAYER_SCREEN } from '@libs/game-matchmaking-harness-ts/multiplayer-places';
import { showGamePuzzleStats } from '@libs/game-session-harness-ts/puzzle-records';
import { Handles } from '@libs/test-ids-shared-ts/handles';

type Screen = 'result' | 'choices' | 'stats';

/**
 * Alice is in her own space on a finished matched game's result: one of
 * finding an opponent's small places, which carries no Find control. Back
 * leads to the game's choices, and the stats choice to the stats.
 */
function resultInOwnSpace() {
  let screen: Screen = 'result';
  const shows: Record<Screen, readonly string[]> = {
    result: [Handles.spaceChromeOverflow, MULTIPLAYER_SCREEN, Handles.navBack],
    choices: [Handles.spaceChromeOverflow, Handles.gameChoice('stats')],
    stats: [Handles.spaceChromeOverflow, Handles.chessStatsElo],
  };
  const leadsTo: Record<string, Screen> = {
    [Handles.navBack]: 'choices',
    [Handles.gameChoice('stats')]: 'stats',
  };
  const node = (handle: string) => ({
    isVisible: () => Promise.resolve(shows[screen].includes(handle)),
    layout: () => Promise.resolve(null),
    tap: () => {
      const next = leadsTo[handle];
      if (!shows[screen].includes(handle) || next === undefined)
        return Promise.reject(new Error(`${handle} is not shown`));
      screen = next;
      return Promise.resolve();
    },
  });
  return {
    actors: new Map([['alice', { ui: { get: node } }]]),
    session: {
      scheduler: { starvedAdvances: () => 0 },
      advanceTime: () => Promise.resolve(),
      waitForIdle: () => Promise.resolve(),
    },
  } as never;
}

describe("reaching a game's puzzle stats", () => {
  // regression: puzzle-stats-unreachable-from-a-finished-matched-game
  test("a finished matched game's result steps back to the game's choices", async () => {
    await expect(
      showGamePuzzleStats.act(resultInOwnSpace(), 'alice', 'some-game')
    ).resolves.toBeUndefined();
  });
});
