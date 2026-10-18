import { changeCustomGame } from '@libs/chess-root-harness/chess-custom-game-board';
import { Given, When } from '@libs/harness/define';
import { customFact, customHumans } from './custom-game-world';

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
