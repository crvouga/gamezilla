import { expect } from 'bun:test';
import { changeCustomGame } from '@libs/chess-root-harness/chess-custom-game-board';
import { Given, Then, When } from '@libs/harness/define';
import {
  customFact,
  customGame,
  customHumans,
  customPerson,
} from './custom-game-world';

Given(
  '{actor} has a Custom Game between {actor} as White and {actor} as Black',
  async (w, host: string, white: string, black: string) =>
    customHumans(w, { host, white, black })
);
Given(
  '{actor} has an active (untimed )Custom Game between {actor} as White and {actor} as Black',
  async (w, host: string, white: string, black: string) =>
    customHumans(w, { host, white, black, active: true })
);
Given(
  '{actor} and {actor} are ready for the Custom Game',
  async (w, white: string, black: string) => {
    await customFact(w, white, { operation: 'ready' });
    await customFact(w, black, { operation: 'ready' });
  }
);

When('{actor} starts the Custom Game', async (w, actor: string) => {
  await w.s.apply(changeCustomGame, actor, { operation: 'start' });
});
When('{actor} resigns the Custom Game', async (w, actor: string) => {
  await w.s.apply(changeCustomGame, actor, { operation: 'resign' });
});

Then(
  '{actor} wins the Custom Game by resignation',
  async (w, actor: string) => {
    const game = await customGame(w);
    const side =
      game.white.person === customPerson(w, actor) ? 'white' : 'black';
    expect(game.status).toBe('completed');
    expect(game.outcome).toBe(`${side} wins by resignation`);
  }
);
