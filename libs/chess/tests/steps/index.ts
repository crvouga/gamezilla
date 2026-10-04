import '@libs/account-privacy/steps/privacy.steps';
import '@libs/account-privacy/steps/exports.steps';
/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (this package's harness
 * composition) and every step definition its features may use — the shared
 * platform steps, this package's own, and the profile, billing and friends
 * steps it reuses (a second device, a Plus membership, friendship, and
 * joining a space).
 */

import '@libs/harness/spec/steps/platform';
import '@libs/profile/steps/profile.steps';
import '@libs/profile/steps/auth.steps';
import '@libs/billing/steps/access.steps';
import '@libs/friends/steps/friends.steps';
import '@libs/friends/steps/spaces.steps';

import { useHarnessWorld } from '@libs/harness/spec/world';
import { openSpecHarness } from '../harness/open-chess-harness';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openSpecHarness, (w) => ({
  beforeAccountDeletion: async (actor: Actor) => {
    await w.s.apply(proveAccount, actor);
    await w.s.apply(seedPuzzleRating, actor, {
      rating: 1800,
      ratingDeviation: PUZZLE_RATING_RD_MIN,
      volatilityMicros: PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
    });
    await w.s.apply(createSpace, actor);
    const customLink = await w.s.read(readSpaceLink, actor);
    await w.s.apply(openPuzzleFromSpace, actor);
    await w.s.apply(playUntilSolved, actor);
    await w.s.apply(showChessStatsScreen, actor);
    remember(w, 'deleted-puzzle-rating', await w.s.read(readStatsElo, actor));
    remember(
      w,
      'deleted-puzzle-label',
      await w.s.read(readStatsRatingLabel, actor)
    );
    remember(
      w,
      'deleted-puzzle-solved',
      await w.s.read(readStatsSolved, actor)
    );
    if (customLink === null) throw new Error('Deleted account has no space');
    await w.s.apply(leaveChessStatsScreen, actor);
    await w.s.apply(reopenSpaceLink, actor, customLink);
    await customDefault(w, actor);
    remember(w, 'deleted-custom-game-id', (await customGame(w)).id);
    remember(w, 'deleted-custom-game-link', w.memo.get('custom-link'));
  },
}));

import { proveAccount } from '@libs/account-privacy/harness/privacy-actions';
import {
  leaveChessStatsScreen,
  openPuzzleFromSpace,
  playUntilSolved,
  showChessStatsScreen,
} from '@libs/chess/harness/chess-actions';
import {
  readStatsElo,
  readStatsRatingLabel,
  readStatsSolved,
} from '@libs/chess/harness/chess-puzzle-ui';
import { seedPuzzleRating } from '@libs/chess/harness/chess-rating-data';
import {
  PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
  PUZZLE_RATING_RD_MIN,
} from '@libs/chess/public/chess-puzzle-rating';
import type { Actor } from '@libs/harness/spec/define';
import { remember } from '@libs/harness/spec/world';
import {
  createSpace,
  reopenSpaceLink,
} from '@libs/spaces/harness/space-actions';
import { readSpaceLink } from '@libs/spaces/harness/spaces-ui-reads';
import { customDefault, customGame } from './custom-game-world';
