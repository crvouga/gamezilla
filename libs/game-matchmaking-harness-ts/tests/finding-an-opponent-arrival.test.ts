import { expect, test } from 'bun:test';
import { findingAnOpponentStep } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
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
