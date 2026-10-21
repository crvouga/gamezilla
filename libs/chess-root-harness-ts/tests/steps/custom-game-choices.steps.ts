import { changeCustomGame } from '@libs/chess-root-harness-ts/chess-custom-game-board';
import { Given, When } from '@libs/harness-ts/define';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { customSpace } from './custom-game-world';

export function customSide(name: string): GameSide {
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
