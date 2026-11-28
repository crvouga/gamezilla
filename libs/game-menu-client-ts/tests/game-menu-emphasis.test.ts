import { expect, test } from 'bun:test';
import { GAME_CHOICE_EMPHASIS } from '@libs/game-menu-client-ts/game-home-screen-view';
import { SHARED_GAME_SCREEN } from '@libs/game-menu-client-ts/shared-game-screens';

// regression: game-menu-puzzle-stats-not-quiet
test("a game's menu quiets every look back, puzzle stats included, and no way to play", () => {
  expect(GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.vsHuman]).toBeUndefined();
  expect(GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.puzzleStats]).toBe('quiet');
  expect(GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.historyHome]).toBe('quiet');
  expect(GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.settings]).toBe('quiet');
  expect(
    GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.matchmakingHome]
  ).toBeUndefined();
});
