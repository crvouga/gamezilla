import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { Given, When } from '@libs/harness/define';
import { customSpace } from './custom-game-world';

export function customSide(name: string): CustomGameSide {
  if (name === 'White') return 'white';
  if (name === 'Black') return 'black';
  throw new Error(`unknown side ${name}`);
}

Given("{actor} is in {actor}'s space", async (w, actor: string, host: string) =>
  customSpace(w, host, [actor])
);

When(
  '{actor} swaps White and Black in the Custom Game',
  async (w, actor: string) =>
    w.s.apply(changeCustomGame, actor, { operation: 'swap' })
);
