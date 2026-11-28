import { describe, expect, test } from 'bun:test';
import { showGameSessions } from '@libs/game-session-harness-ts/game-navigation';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/**
 * Bob is in the space as its game menu shows a game, but the menu moves on
 * by itself before his tap lands (the host's chosen game arrives); the
 * game sessions then show.
 */
function menuThatMovesOn(firstHandle: string, tapDurationMs: number) {
  let moved = false;
  let now = 0;
  const shown = (handle: string): boolean =>
    handle === (moved ? 'game-session-content' : firstHandle);
  const node = (handle: string) => ({
    isVisible: () => Promise.resolve(shown(handle)),
    layout: () => Promise.resolve(null),
    tap: () => {
      moved = true;
      now += tapDurationMs;
      return Promise.reject(
        new Error(`${handle} tap: Timed out after 5000ms waiting for visible`)
      );
    },
  });
  const ui = {
    get: node,
    snapshotHtml: async () => '<main data-screen="game-sessions-home"></main>',
  };
  return {
    actors: new Map([['bob', { ui }]]),
    harness: { composition: { app: { turnGames: { games: [] } } } },
    session: {
      scheduler: {
        virtual: false,
        clock: { now: () => now },
        starvedAdvances: () => 0,
      },
      advanceTime: async (ms: number) => {
        now += ms;
      },
      waitForIdle: () => Promise.resolve(),
    },
  } as never;
}

describe('reaching the game sessions of a space', () => {
  // regression: game-session-navigation-offline-or-watching
  // regression: space-menu-moves-on-before-tap
  test('a menu that moves on before the tap lands is looked at again', async () => {
    await expect(
      showGameSessions(
        menuThatMovesOn(Handles.gameMenu('some-game'), 0),
        'bob',
        'some-game'
      )
    ).resolves.toBeUndefined();
  });

  // regression: connect-four-game-session-arrival-at-deadline
  test('Bob reaches game sessions when the screen opens during the final menu tap', async () => {
    const game = menuThatMovesOn(Handles.gameChoice('vs-human'), 15_000);
    await expect(
      showGameSessions(game, 'bob', 'some-game')
    ).resolves.toBeUndefined();
  });
});
