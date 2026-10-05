import { expect } from 'bun:test';
import type { CustomGame } from '@libs/chess-custom-game-shared/custom-game-state';
import { readExportedCustomGames } from '@libs/chess-root-harness/custom-game-export';
import { Then } from '@libs/harness/define';

// regression: chess-custom-export-category
Then(
  "{actor}'s personal-data export includes the Custom Game choices moves and outcome",
  async (w, actor: string) => {
    const game = w.memo.get('custom-completed') as CustomGame;
    expect(await w.s.read(readExportedCustomGames, actor)).toContainEqual(
      expect.objectContaining({
        id: game.id,
        white: game.white,
        black: game.black,
        minutes: game.minutes,
        increment: game.increment,
        moves: [{ uci: 'e2e4', san: 'e4' }],
        outcome: 'black wins by resignation',
      })
    );
  }
);
Then(
  "{actor}'s personal-data export cannot include {actor}'s Custom Game",
  async (w, actor: string, _owner: string) => {
    expect(await w.s.read(readExportedCustomGames, actor)).toEqual([]);
  }
);
