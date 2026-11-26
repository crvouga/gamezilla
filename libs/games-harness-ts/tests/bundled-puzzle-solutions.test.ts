import { test } from 'bun:test';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import { assertPuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';

for (const game of GAME_DEFINITIONS) {
  const content = game.puzzleContent;
  if (content?.bundledPacks?.length) {
    test(`${game.id} completes every bundled puzzle from its shipped position`, () => {
      assertPuzzleContent(game.id, content);
    });
  }
}
