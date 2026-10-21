import { expect } from 'bun:test';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import { attemptCustomGameChoice } from '@libs/game-session-harness-ts/custom-game-ui';
import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import { restoreNetwork } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { cutConnection } from '@libs/harness-ts/platform';
import { choose, chosen, current, toldOf } from './custom-game-set-up-world';
import {
  backToCustomGames,
  before,
  hostOf,
  rememberCustomGame,
} from './game-world';

const SECOND_MS = 1000;
/** How long a device back online may take to show it is connected again. */
const RECONNECT_MS = 5 * SECOND_MS;

Given(
  '{actor} is back online after his offline claim was refused',
  async (w, actor: string) => {
    await cutConnection(w, actor);
    await choose(w, actor, { operation: 'claim', side: 'black' });
    await toldOf(w, actor, 'connection needed');
    await w.s.apply(restoreNetwork);
    await w.s.until((s) => customGameView(s, actor), {
      pred: (seen) => seen.connected,
      maxMs: RECONNECT_MS,
    });
  }
);
Given('{actor} has started the custom game', async (w, actor: string) => {
  await chosen(w, actor, { operation: 'start' });
  await rememberCustomGame(w);
});
Given('{actor} has resigned the custom game', async (w, actor: string) => {
  await chosen(w, actor, { operation: 'resign' });
  await rememberCustomGame(w);
});
Given(
  'the {gameSide} has since been replaced by a bot',
  async (w, side: CustomGameSide) => {
    w.memo.set('custom-game-earlier', await current(w));
    await chosen(w, hostOf(w), { operation: 'bot', side });
  }
);

When(
  '{actor} opens the {gameSide} with the earlier set-up',
  async (w, actor: string, side: CustomGameSide) => {
    const earlier = w.memo.get('custom-game-earlier') as CustomGame;
    await w.s.apply(attemptCustomGameChoice, actor, {
      operation: 'open',
      side,
      gameId: earlier.id,
      revision: earlier.revision,
    });
  }
);

Then('the custom game is still being set up', async (w) => {
  const game = await current(w);
  expect(game.id).toBe(before(w).current?.id ?? '');
  expect(game.status).toBe('configuring');
});
// regression: custom-game-reconnect-read-before-settlement
Then('{actor} sees the finished custom game', async (w, actor: string) => {
  await backToCustomGames(w, actor);
  const seen = await w.s.until((s) => customGameView(s, actor), {
    pred: (view) => view.current?.status === 'completed',
    maxMs: RECONNECT_MS,
  });
  expect(seen.current).toEqual(before(w).current);
});
