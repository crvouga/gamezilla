import { changeGameSession } from '@libs/chess-root-harness-ts/chess-game-session-board';
import { Given, When } from '@libs/harness-ts/define';
import { customFact, customHumans } from './game-session-world';

Given(
  '{actor} has a game session between {actor} as White and {actor} as Black',
  async (w, host: string, white: string, black: string) =>
    customHumans(w, { host, white, black })
);
Given(
  '{actor} has an active (untimed )game session between {actor} as White and {actor} as Black',
  async (w, host: string, white: string, black: string) =>
    customHumans(w, { host, white, black, active: true })
);
Given(
  '{actor} has swapped White and Black in the game session',
  async (w, actor: string) => customFact(w, actor, { operation: 'swap' })
);
Given(
  '{actor} and {actor} are ready for the game session',
  async (w, white: string, black: string) => {
    await customFact(w, white, { operation: 'ready' });
    await customFact(w, black, { operation: 'ready' });
  }
);

When('{actor} starts the game session', async (w, actor: string) => {
  await w.s.apply(changeGameSession, actor, { operation: 'start' });
});
