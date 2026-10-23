/** Battleship against bots, and two bots playing each other. */

import { expect } from 'bun:test';
import { startBattleship } from '@libs/battleship-harness-ts/battleship-actions';
import {
  type BattleshipBotDifficulty,
  establishBattleshipBots,
  letBattleshipBotsPlay,
} from '@libs/battleship-harness-ts/battleship-bots';
import { Given, Then, When } from '@libs/harness-ts/define';
import { sees } from './battleship-world';

function difficultyNamed(text: string): BattleshipBotDifficulty {
  const difficulty = text.toLowerCase();
  if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard')
    return difficulty;
  throw new Error(`Unknown difficulty ${text}`);
}

Given(
  '{actor} is ready for a custom game of Battleship against the {word} bot',
  async (w, actor: string, difficulty: string) => {
    await w.s.apply(
      establishBattleshipBots,
      actor,
      'bot',
      difficultyNamed(difficulty)
    );
  }
);
Given(
  '{actor} has started a custom game of Battleship between two {word} bots',
  async (w, actor: string, difficulty: string) => {
    await w.s.apply(
      establishBattleshipBots,
      'bot',
      'bot',
      difficultyNamed(difficulty)
    );
    await w.s.apply(startBattleship, actor);
  }
);

When('the bots play their turns', async (w) => {
  await w.s.apply(letBattleshipBotsPlay, 'alice');
});

Then('the Battleship bot is ready with a complete fleet', async (w) => {
  // The room readies a bot with its own fleet as the game starts; a start
  // is refused while any side lacks one, so the bot's seat in a started
  // game is the bot readied with its fleet.
  const game = (await sees(w, 'alice')).screen.current;
  expect(game?.status).toBe('active');
  expect(game?.black.kind).toBe('bot');
});
Then('one Battleship bot wins', async (w) => {
  const game = (await sees(w, 'alice')).screen.current;
  expect(game?.status).toBe('completed');
  expect(game?.outcome).toMatch(/^(white|black) wins/);
});
