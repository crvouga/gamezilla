import { expect } from 'bun:test';
import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import {
  customGameUnratedShown,
  legalWhiteBotMoveShown,
} from '@libs/chess-custom-game-harness/custom-game-continuity-reads';
import { Given, Then } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection } from '@libs/harness/platform';
import {
  customDefault,
  customFact,
  customGame,
  customHost,
  customScreen,
  customStart,
} from './custom-game-world';

Then('The Custom Game is completed by resignation', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('completed');
  expect(game.outcome).toMatch(/^(white|black) wins by resignation$/);
});

Then('The Custom Game is unrated', async (w) => {
  expect(await w.s.read(customGameUnratedShown, customHost(w))).toBe(true);
});

Then(
  'A legal White bot move follows within {int} seconds',
  async (w, seconds: number) => {
    await w.s.until((s) => legalWhiteBotMoveShown(s, customHost(w)), {
      maxMs: seconds * 1000,
      pred: Boolean,
    });
  }
);

Given(
  '{actor} has completed a Custom Game against a bot by resignation while offline',
  async (w, actor: Actor) => {
    await customDefault(w, actor);
    await customFact(w, actor, { operation: 'bot', side: 'black' });
    await customStart(w);
    await cutConnection(w, actor);
    await w.s.apply(changeCustomGame, actor, { operation: 'resign' });
    expect((await customGame(w, actor)).status).toBe('completed');
  }
);

Given(
  '{actor} is watching the Custom Game while offline',
  async (w, actor: Actor) => {
    await customScreen(w, actor);
    await cutConnection(w, actor);
  }
);
