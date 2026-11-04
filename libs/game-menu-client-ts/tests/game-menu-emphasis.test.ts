import { expect, test } from 'bun:test';
import { GAME_CHOICE_EMPHASIS } from '@libs/game-menu-client-ts/game-menu-screen-view';
import { SHARED_GAME_SCREEN } from '@libs/game-menu-client-ts/shared-game-screens';

// regression: game-menu-puzzle-stats-not-quiet
test("a game's menu leads with custom games and quiets every look back, puzzle stats included", () => {
  expect(GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.customGames]).toBe('primary');
  expect(GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.puzzleStats]).toBe('quiet');
  expect(GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.history]).toBe('quiet');
  expect(GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.settings]).toBe('quiet');
  expect(GAME_CHOICE_EMPHASIS[SHARED_GAME_SCREEN.matchmaking]).toBeUndefined();
});
