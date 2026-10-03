import '@libs/account-privacy/steps/privacy.steps';
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
import '@libs/billing/steps/access.steps';
import '@libs/friends/steps/friends.steps';
import '@libs/friends/steps/spaces.steps';
import './puzzle-play.steps';
import './multiplayer-find.steps';
import './puzzle-opening.steps';
import './puzzle-assistant.steps';
import './puzzle-refusals.steps';
import './account-privacy.steps';
import './puzzle-feed.steps';
import './puzzle-feed-editing.steps';
import './puzzle-competing-results.steps';
import './puzzle-rating.steps';
import './puzzle-review.steps';
import './puzzle-sound.steps';
import './puzzle-allowance.steps';
import './puzzle-spectator.steps';
import './puzzle-recovery.steps';
import './space-game.steps';

import { useHarnessWorld } from '@libs/harness/spec/world';
import { openSpecHarness } from '../harness/open-chess-harness';

useHarnessWorld(openSpecHarness, (w) => ({
  beforeAccountDeletion: async (actor: Actor) => {
    await w.s.apply(proveAccount, actor);
    await w.s.apply(seedPuzzleRating, actor, {
      rating: 1800,
      ratingDeviation: PUZZLE_RATING_RD_MIN,
      volatilityMicros: PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
    });
    await w.s.apply(createSpace, actor);
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
  },
}));

import { proveAccount } from '@libs/account-privacy/harness/privacy-actions';
import {
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
import { createSpace } from '@libs/spaces/harness/space-actions';

import './multiplayer-game.steps';
import './multiplayer-recovery.steps';
import './multiplayer-accessibility.steps';
import './multiplayer-account.steps';
import './multiplayer-policies.steps';
