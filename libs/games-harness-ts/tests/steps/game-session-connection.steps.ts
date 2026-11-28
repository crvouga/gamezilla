import { expect } from 'bun:test';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import { attemptGameSessionChoice } from '@libs/game-session-harness-ts/game-session-ui';
import type {
  GameSession,
  GameSessionSide,
} from '@libs/game-session-shared-ts/game-session-state';
import { restoreNetwork } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { cutConnection } from '@libs/harness-ts/platform';
import { choose, chosen, current, toldOf } from './game-session-set-up-world';
import {
  backToGameSessions,
  before,
  hostOf,
  rememberGameSession,
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
    await w.s.until((s) => gameSessionView(s, actor), {
      pred: (seen) => seen.connected,
      maxMs: RECONNECT_MS,
    });
  }
);
Given('{actor} has started the game session', async (w, actor: string) => {
  await chosen(w, actor, { operation: 'start' });
  await rememberGameSession(w);
});
Given('{actor} has resigned the game session', async (w, actor: string) => {
  await chosen(w, actor, { operation: 'resign' });
  await rememberGameSession(w);
});
Given(
  'the {gameSide} has since been replaced by a bot',
  async (w, side: GameSessionSide) => {
    w.memo.set('game-session-earlier', await current(w));
    await chosen(w, hostOf(w), { operation: 'bot', side });
  }
);

When(
  '{actor} opens the {gameSide} with the earlier set-up',
  async (w, actor: string, side: GameSessionSide) => {
    const earlier = w.memo.get('game-session-earlier') as GameSession;
    await w.s.apply(attemptGameSessionChoice, actor, {
      operation: 'open',
      side,
      gameId: earlier.id,
      revision: earlier.revision,
    });
  }
);

Then('the game session is still being set up', async (w) => {
  const game = await current(w);
  expect(game.id).toBe(before(w).current?.id ?? '');
  expect(game.status).toBe('configuring');
});
// regression: game-session-reconnect-read-before-settlement
Then('{actor} sees the finished game session', async (w, actor: string) => {
  await backToGameSessions(w, actor);
  const seen = await w.s.until((s) => gameSessionView(s, actor), {
    pred: (view) => view.current?.status === 'completed',
    maxMs: RECONNECT_MS,
  });
  expect(seen.current).toEqual(before(w).current);
});
