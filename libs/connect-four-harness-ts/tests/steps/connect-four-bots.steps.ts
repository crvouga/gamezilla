import { expect } from 'bun:test';
import {
  connectFourBotTactics,
  establishConnectFourBotPosition,
} from '@libs/connect-four-harness-ts/connect-four-bots';
import { Given, Then, When } from '@libs/harness-ts/define';
import { four } from './connect-four-world';

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
When('the Connect Four bot plays', async (w) => {
  await w.s.advanceTime(1000);
});
Then('the Connect Four bot wins immediately', async (w) => {
  expect((await four(w)).current?.outcome).toBe('black wins by four in a row');
});
Then('the opponent has no immediate Connect Four victory', async (w) => {
  expect((await w.s.read(connectFourBotTactics)).immediateOpponentWin).toBe(
    false
  );
});
