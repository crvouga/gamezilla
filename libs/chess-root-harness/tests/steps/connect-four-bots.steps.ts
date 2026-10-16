import { expect } from 'bun:test';
import {
  connectFourBotTactics,
  establishConnectFourBotPosition,
  playConnectFourBots,
} from '@libs/connect-four-harness/connect-four-bots';
import { Given, Then, When } from '@libs/harness/define';
import { four, setupFour } from './connect-four-world';

Given(
  '{actor} has an active Connect Four custom game with two bots',
  async (w) => setupFour(w, { red: 'bot', yellow: 'bot' })
);
Given('a Hard Connect Four bot can win on its turn', async (w) => {
  // regression: connect-four-solo-bot-tactical-precondition
  await w.s.apply(establishConnectFourBotPosition, [0, 0, 1, 1, 2]);
});
Given(
  "a Hard Connect Four bot can prevent the opponent's next-turn victory",
  async (w) => {
    await w.s.apply(establishConnectFourBotPosition, [3, 4, 5]);
  }
);
When('the Connect Four bots play their turns', async (w) => {
  await w.s.apply(playConnectFourBots);
});
When('the Connect Four bot plays', async (w) => {
  await w.s.advanceTime(1000);
});
Then(
  'Connect Four has a victory or draw within {int} seconds',
  async (w, seconds: number) => {
    expect(seconds).toBeGreaterThanOrEqual(42);
    expect((await four(w)).current?.status).toBe('completed');
  }
);
Then('every Connect Four drop obeys gravity', async (w) => {
  expect((await w.s.read(connectFourBotTactics)).gravity).toBe(true);
});
Then('the Connect Four bot wins immediately', async (w) => {
  expect((await four(w)).current?.outcome).toBe('black wins by four in a row');
});
Then('the opponent has no immediate Connect Four victory', async (w) => {
  expect((await w.s.read(connectFourBotTactics)).immediateOpponentWin).toBe(
    false
  );
});
