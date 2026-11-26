import { describe, expect, test } from 'bun:test';
import { showCustomGames } from '@libs/game-session-harness-ts/game-navigation';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/**
 * Bob is in the space as its game menu shows a game, but the menu moves on
 * by itself before his tap lands (the host's chosen game arrives); the
 * custom games then show.
 */
function menuThatMovesOn(firstHandle: string, tapDurationMs: number) {
  let moved = false;
  let now = 0;
  const shown = (handle: string): boolean =>
    handle === (moved ? 'custom-game-content' : firstHandle);
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
    snapshotHtml: async () => '<main data-screen="custom-games-home"></main>',
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

describe('reaching the custom games of a space', () => {
  // regression: custom-game-navigation-offline-or-watching
  // regression: space-menu-moves-on-before-tap
  test('a menu that moves on before the tap lands is looked at again', async () => {
    await expect(
      showCustomGames(
        menuThatMovesOn(Handles.gameMenu('some-game'), 0),
        'bob',
        'some-game'
      )
    ).resolves.toBeUndefined();
  });

  // regression: connect-four-custom-game-arrival-at-deadline
  test('Bob reaches custom games when the screen opens during the final menu tap', async () => {
    const game = menuThatMovesOn(Handles.gameChoice('custom-game'), 15_000);
    await expect(
      showCustomGames(game, 'bob', 'some-game')
    ).resolves.toBeUndefined();
  });
});
