import { expect, test } from 'bun:test';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import { writeKnownPuzzlePool } from '@libs/game-session-harness-ts/puzzle-pool';
import {
  isPuzzleStatsShown,
  readStatsPuzzleRating,
  showGamePuzzleStats,
} from '@libs/game-session-harness-ts/puzzle-records';
import { openGamePuzzles } from '@libs/game-session-harness-ts/puzzle-screen';
import {
  partition,
  refreshActorConnection,
  refreshActorQueries,
} from '@libs/harness-ts/actions';
import { returnToTabs, signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { focusActor } from '@libs/harness-ts/shell-actions';
import {
  createSpace,
  joinViaLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { SOLO_COUNT_GAME } from './solo-count-game';

const SYSTEM = gameSystem('watcher-own-stats', [SOLO_COUNT_GAME], {
  knownPuzzles: true,
});

// regression: puzzle-stats-unreachable-from-a-guest-space
test("a watcher in an offline host's space reaches their own puzzle stats", async () => {
  await using s = await openGameHarness(SYSTEM, 'watcher-own-stats');
  const id = SOLO_COUNT_GAME.shared.id;
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(writeKnownPuzzlePool, id, [{ id: 'solo-count/two-twos' }]);
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', id);
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('alice is not in a space');
  await s.apply(focusActor, 'bob');
  await s.apply(joinViaLink, 'bob', link);
  // The host goes offline: the space Bob is in stops following anyone.
  await s.apply(partition, 'alice');
  await s.apply(refreshActorConnection, 'alice');
  await s.apply(refreshActorQueries, 'alice');
  await s.apply(focusActor, 'bob');
  await s.apply(showGamePuzzleStats, 'bob', id);
  expect(await s.read(isPuzzleStatsShown, 'bob')).toBe(true);
  expect(await s.read(readStatsPuzzleRating, 'bob')).not.toBeNull();
}, 120_000);
