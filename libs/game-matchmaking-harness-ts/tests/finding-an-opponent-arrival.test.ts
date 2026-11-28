import { expect, test } from 'bun:test';
import {
  findingAnOpponentHandles,
  findingAnOpponentStep,
  GAME_SESSION_CONTENT,
  tapWayIn,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { HarnessActor } from '@libs/harness-ts/harness';
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

// regression: finish-game-session-first-dead-end
test('a space held on a game session under way is as far as finding an opponent goes', () => {
  // The board offers no way out while the game lasts: there is nothing to tap.
  const held = new Set([GAME_SESSION_CONTENT]);
  expect(findingAnOpponentStep(held, GAME, false)).toBe('arrived');
  expect(findingAnOpponentStep(held, GAME, true)).toBe('arrived');
  // A finished game session still has its Back to the game's choices.
  expect(
    findingAnOpponentStep(
      new Set([GAME_SESSION_CONTENT, Handles.navBack]),
      GAME,
      false
    )
  ).toBe(Handles.navBack);
});

// regression: finding-opponent-leaves-loading-space
test('a new device stays in the space while its games load under the Back button', () => {
  expect(findingAnOpponentHandles(GAME)).toContain(Handles.spaceLoading);
  const loading = new Set([Handles.navBack, Handles.spaceLoading]);
  expect(findingAnOpponentStep(loading, GAME, false)).toBeNull();
});

// regression: finding-opponent-leaves-join-preview
test('a second device waits in the join preview and enters when Join appears', () => {
  const preview = new Set<string>([Handles.spaceJoinPrompt, Handles.navBack]);
  expect(findingAnOpponentHandles(GAME)).toContain(Handles.spaceJoinPrompt);
  expect(findingAnOpponentHandles(GAME)).toContain(Handles.spaceJoin);
  expect(findingAnOpponentStep(preview, GAME, false)).toBeNull();
  preview.add(Handles.spaceJoin);
  expect(findingAnOpponentStep(preview, GAME, false)).toBe(Handles.spaceJoin);
  preview.add(Handles.spaceNotFound);
  expect(findingAnOpponentStep(preview, GAME, false)).toBe('nowhere');
});

// regression: second-device-join-gone-before-tap
test('a way in that goes before the tap lands is looked at again, not a failure', async () => {
  // A second device's Join gives way to the space once its membership arrives.
  const gone = {
    tap: () => Promise.reject(new Error('Timed out waiting for space-join')),
    isVisible: () => Promise.resolve(false),
  };
  const showing = (node: typeof gone) =>
    ({ get: () => node }) as unknown as HarnessActor['ui'];
  await tapWayIn(showing(gone), Handles.spaceJoin);
  const stuck = {
    tap: () => Promise.reject(new Error('Timed out waiting for space-join')),
    isVisible: () => Promise.resolve(true),
  };
  await expect(tapWayIn(showing(stuck), Handles.spaceJoin)).rejects.toThrow(
    'space-join'
  );
});
