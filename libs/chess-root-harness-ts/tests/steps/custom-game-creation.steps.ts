import { changeCustomGame } from '@libs/chess-root-harness-ts/chess-custom-game-board';
import { Given, When } from '@libs/harness-ts/define';
import { customFact, customHumans } from './custom-game-world';

Given(
  '{actor} has a custom game between {actor} as White and {actor} as Black',
  async (w, host: string, white: string, black: string) =>
    customHumans(w, { host, white, black })
);
Given(
  '{actor} has an active (untimed )custom game between {actor} as White and {actor} as Black',
  async (w, host: string, white: string, black: string) =>
    customHumans(w, { host, white, black, active: true })
);
Given(
  '{actor} and {actor} are ready for the custom game',
  async (w, white: string, black: string) => {
    await customFact(w, white, { operation: 'ready' });
    await customFact(w, black, { operation: 'ready' });
  }
);

When('{actor} starts the custom game', async (w, actor: string) => {
  await w.s.apply(changeCustomGame, actor, { operation: 'start' });
});
