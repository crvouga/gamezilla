/**
 * People seeking an opponent being paired: matchmaking pairs everyone it
 * can each second while their rating ranges grow, until nobody is left
 * waiting or the ranges are as wide as they grow.
 */

import { pairGameOpponents } from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { waitingSearchCount } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { OPPONENT_SEARCH_RADIUS } from '@libs/game-matchmaking-shared-ts/search-config';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

const SECOND_MS = 1000;

/** The longest a search waits before its range reaches the widest. */
const WIDEST_RANGE_MS =
  ((OPPONENT_SEARCH_RADIUS.maxRadius - OPPONENT_SEARCH_RADIUS.baseRadius) /
    OPPONENT_SEARCH_RADIUS.radiusGrowthPerSecond) *
    SECOND_MS +
  SECOND_MS;

/**
 * Every waiting person is paired as soon as their ranges allow; equal side
 * balances are settled the same way on every run.
 */
export async function pairUp(w: HarnessWorld): Promise<void> {
  for (let waited = 0; ; waited += SECOND_MS) {
    await w.s.apply(pairGameOpponents, 'alice', true);
    if (waited >= WIDEST_RANGE_MS) return;
    if ((await w.s.read(waitingSearchCount)) === 0) return;
    await w.s.advanceTime(SECOND_MS);
  }
}
