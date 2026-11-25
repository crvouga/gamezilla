import { describe, expect, test } from 'bun:test';
import { showCustomGames } from '@libs/game-session-harness-ts/game-navigation';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/**
 * Bob is in the space as its game menu shows a game, but the menu moves on
 * by itself before his tap lands (the host's chosen game arrives); the
 * custom games then show.
 */
function menuThatMovesOn() {
  let moved = false;
  const shown = (handle: string): boolean =>
    moved
      ? handle === 'custom-game-content'
      : handle === Handles.gameMenu('some-game');
  const node = (handle: string) => ({
    isVisible: () => Promise.resolve(shown(handle)),
    layout: () => Promise.resolve(null),
    tap: () => {
      moved = true;
      return Promise.reject(
        new Error(`${handle} tap: Timed out after 5000ms waiting for visible`)
      );
    },
  });
  return {
    actors: new Map([['bob', { ui: { get: node } }]]),
    harness: { composition: { app: { turnGames: { games: [] } } } },
    session: {
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: () => Promise.resolve(),
      waitForIdle: () => Promise.resolve(),
    },
  } as never;
}

describe('reaching the custom games of a space', () => {
  // regression: custom-game-navigation-offline-or-watching
  // regression: space-menu-moves-on-before-tap
  test('a menu that moves on before the tap lands is looked at again', async () => {
    await expect(
      showCustomGames(menuThatMovesOn(), 'bob', 'some-game')
    ).resolves.toBeUndefined();
  });
});
