import { expect, test } from 'bun:test';
import {
  CUSTOM_GAME_CONTENT,
  findingAnOpponentStep,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const GAME = 'any-game';

// regression: ended-space-multiplayer-show
test('an ended space is the arrival, even though Back is also on screen', () => {
  const ended = new Set([
    Handles.navBack,
    'status-current-user',
    Handles.spaceEnded,
  ]);
  expect(findingAnOpponentStep(ended, GAME, true)).toBe('arrived');
  expect(findingAnOpponentStep(ended, GAME, false)).toBe('nowhere');
  expect(
    findingAnOpponentStep(new Set([Handles.spaceNotFound]), GAME, true)
  ).toBe('arrived');
  expect(findingAnOpponentStep(new Set([Handles.navBack]), GAME, true)).toBe(
    Handles.navBack
  );
  expect(
    findingAnOpponentStep(new Set([Handles.gameMenu(GAME)]), GAME, true)
  ).toBe(Handles.gameMenu(GAME));
  expect(
    findingAnOpponentStep(
      new Set([Handles.gameMenu(GAME), 'multiplayer-find']),
      GAME,
      false
    )
  ).toBe('arrived');
});

test('a place opened within finding an opponent is the arrival, never a Back to press', () => {
  // Its Back steps out of the place: pressing it would undo what the person opened.
  const opened = new Set([Handles.navBack, 'multiplayer-screen']);
  expect(findingAnOpponentStep(opened, GAME, false)).toBe('arrived');
  expect(findingAnOpponentStep(opened, GAME, true)).toBe('arrived');
});

// regression: finish-custom-game-first-dead-end
test('a space held on a custom game under way is as far as finding an opponent goes', () => {
  // The board offers no way out while the game lasts: there is nothing to tap.
  const held = new Set([CUSTOM_GAME_CONTENT]);
  expect(findingAnOpponentStep(held, GAME, false)).toBe('arrived');
  expect(findingAnOpponentStep(held, GAME, true)).toBe('arrived');
  // A finished custom game still has its Back to the game's choices.
  expect(
    findingAnOpponentStep(
      new Set([CUSTOM_GAME_CONTENT, Handles.navBack]),
      GAME,
      false
    )
  ).toBe(Handles.navBack);
});
