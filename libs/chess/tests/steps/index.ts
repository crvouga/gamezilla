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
import './custom-game-creation.steps';
import './custom-game-choices.steps';
import './custom-game-refusals.steps';
import './custom-game-play.steps';
import './custom-game-histories.steps';
import './custom-game-races.steps';
import './custom-game-recovery.steps';
import './custom-game-access.steps';
import './custom-game-devices.steps';
import './custom-game-accessibility.steps';
import './custom-game-privacy.steps';
import './custom-game-export.steps';

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

import './multiplayer-game.steps';
import './multiplayer-recovery.steps';
import './multiplayer-accessibility.steps';
import './multiplayer-account.steps';
import './multiplayer-policies.steps';
import {
  createSpace,
  reopenSpaceLink,
} from '@libs/spaces/harness/space-actions';
import { readSpaceLink } from '@libs/spaces/harness/spaces-ui-reads';
import { customDefault, customGame } from './custom-game-world';
