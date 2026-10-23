/**
 * A person reviewing an earlier position of their matched game: the board
 * in front of them takes no move, so a move they try there is never sent.
 */

import { expect } from 'bun:test';
import { viewerOf } from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { multiplayerBoardShown } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { shownEarlierPosition } from '@libs/game-matchmaking-harness-ts/multiplayer-review';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

const reviewingKey = (person: string) => `matched-game:reviewing:${person}`;

/** `person` is (or no longer is) reviewing an earlier position. */
export function markReviewing(
  w: HarnessWorld,
  person: string,
  reviewing: boolean
): void {
  if (reviewing) w.memo.set(reviewingKey(person), true);
  else w.memo.delete(reviewingKey(person));
}

/** Whether the scenario left `person` reviewing an earlier position. */
export function reviewsEarlierPosition(
  w: HarnessWorld,
  person: string
): boolean {
  return w.memo.has(reviewingKey(person));
}

/**
 * The person's hand tries a move on the earlier position their screen
 * shows: the board takes none, so nothing reaches the matched game.
 */
export async function boardTakesNoMove(w: HarnessWorld, person: string) {
  const device = viewerOf(w, person);
  expect(await w.s.read(shownEarlierPosition, device)).not.toBeNull();
  expect((await w.s.read(multiplayerBoardShown, device)).boardTakesMoves).toBe(
    false
  );
}
