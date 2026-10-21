import { expect, test } from 'bun:test';
import { requestGameOpponent } from '@libs/game-matchmaking-harness-ts/multiplayer-search-ui';
import { withOpponentSearchCleanup } from '@libs/game-matchmaking-harness-ts/opponent-search-cleanup';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { OpenHarness } from '@libs/harness-ts/open-harness';

// regression: matchmaking-scenario-leaks-waiting-player
test('owned search cancellation reaches the server before its browser is disposed', async () => {
  let waiting = false;
  let pending = 0;
  const events: string[] = [];
  const ui = {
    get: (id: string) => ({
      wait: async () => {},
      tap: async () => {
        if (id === 'multiplayer-find') waiting = true;
        if (id === 'multiplayer-stop') {
          waiting = false;
          pending = 1;
          events.push('stop');
        }
      },
      isVisible: async () =>
        ['multiplayer-waiting', 'multiplayer-stop'].includes(id) && waiting,
    }),
  };
  const harness = {
    actors: new Map([
      ['alice', { ui, localSql: () => ({ query: async () => [{ pending }] }) }],
    ]),
    session: {
      scheduler: { starvedAdvances: () => 0 },
      advanceTime: async () => {
        pending = 0;
        events.push('acknowledged');
      },
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
  await Promise.resolve(
    requestGameOpponent.act(harness, 'alice', 'counting/5+0')
  );
  const run = withOpponentSearchCleanup({
    apply: async (action: { act(s: ProductHarness): unknown }) => {
      await Promise.resolve(action.act(harness));
    },
    [Symbol.asyncDispose]: async () => {
      events.push('disposed');
    },
  } as unknown as OpenHarness);
  await run[Symbol.asyncDispose]();
  await run[Symbol.asyncDispose]();
  expect(events).toEqual(['stop', 'acknowledged', 'disposed']);
});
