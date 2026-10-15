import { expect, test } from 'bun:test';
import { requestGameOpponent } from '@libs/game-matchmaking-harness/multiplayer-search-ui';
import type { ProductHarness } from '@libs/harness/harness';

test('an immediate assignment completes the ordinary search without requiring a waiting screen', async () => {
  let requests = 0;
  const ui = {
    get: (id: string) => ({
      tap: async () => {
        if (id === 'multiplayer-find') requests += 1;
      },
      wait: async () => {},
      isVisible: async () => id === 'multiplayer-game' && requests === 1,
    }),
  };
  const s = {
    actors: new Map([['alice', { ui }]]),
  } as unknown as ProductHarness;
  await Promise.resolve(requestGameOpponent.act(s, 'alice', '2+1'));
  expect(requests).toBe(1);
});
