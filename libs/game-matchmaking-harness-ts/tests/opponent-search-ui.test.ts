import { expect, test } from 'bun:test';
import { requestGameOpponent } from '@libs/game-matchmaking-harness-ts/multiplayer-search-ui';
import { withOpponentSearchCleanup } from '@libs/game-matchmaking-harness-ts/opponent-search-cleanup';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { searchHub } from './search-hub-fixture';

test('an immediate assignment completes the ordinary search without requiring a waiting screen', async () => {
  const requests = () =>
    pressed.filter((id) => id === 'multiplayer-find').length;
  const { ui, pressed } = searchHub(
    (id) => id === 'multiplayer-game' && requests() === 1
  );
  const s = {
    actors: new Map([['alice', { ui }]]),
  } as unknown as ProductHarness;
  await Promise.resolve(requestGameOpponent.act(s, 'alice', '2+1'));
  let disposed = 0;
  const run = withOpponentSearchCleanup({
    apply: async (action: { act(state: ProductHarness): unknown }) => {
      await Promise.resolve(action.act(s));
    },
    [Symbol.asyncDispose]: async () => {
      disposed += 1;
    },
  } as unknown as OpenHarness);
  await run[Symbol.asyncDispose]();
  // The clock is chosen on its own place, one row from the hub, then Find.
  expect(pressed).toEqual([
    'multiplayer-open-time-control',
    'multiplayer-time-control-2-1',
    'multiplayer-find',
  ]);
  expect(disposed).toBe(1);
});
