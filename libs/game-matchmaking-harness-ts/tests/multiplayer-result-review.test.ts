import { expect, test } from 'bun:test';
import { showMultiplayerMoveList } from '@libs/game-matchmaking-harness-ts/multiplayer-places';
import type { ProductHarness } from '@libs/harness-ts/harness';

// regression: battleship-watcher-result-covers-history
test('a watcher opens Review when the result dialog covers the first move', async () => {
  let place = 'result';
  const ui = {
    get: (id: string) => ({
      isVisible: async () =>
        id === 'multiplayer-screen' ||
        id === 'multiplayer-move-list' ||
        (place === 'result' &&
          (id === 'game-result-close' || id === 'multiplayer-open-moves')),
      attribute: async (name: string) =>
        name === 'data-stage' ? 'finished' : place,
      tap: async () => {
        expect(id).toBe('multiplayer-open-moves');
        place = 'moves';
      },
    }),
  };
  const harness = {
    session: { scheduler: { virtual: true } },
    actors: new Map([['carol', { ui }]]),
  } as unknown as ProductHarness;
  expect(await showMultiplayerMoveList(harness, 'carol')).toBe(true);
  expect(place).toBe('moves');
  expect(await showMultiplayerMoveList(harness, 'carol')).toBe(false);
});
