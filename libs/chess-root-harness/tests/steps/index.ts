import '@libs/account-privacy-harness/privacy.steps';
import '@libs/account-privacy-harness/exports.steps';
/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (this package's harness
 * composition) and every step definition its features may use — the shared
 * platform steps, this package's own, and the profile, billing and friends
 * steps it reuses (a second device, a Plus membership, friendship, and
 * joining a space).
 */

import '@libs/harness/platform';
import '@libs/harness/sounds.steps';
import '@libs/game-matchmaking-harness/matched-game-app.steps';
import '@libs/profile-harness/profile.steps';
import '@libs/profile-harness/auth.steps';
import '@libs/billing-harness/access.steps';
import '@libs/friends-harness/friends.steps';
import '@libs/friends-harness/spaces.steps';
import '@libs/friends-harness/space-offline.steps';
import '@libs/friends-harness/space-idle.steps';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { setPhoneOfflineHook } from '@libs/harness/platform';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { openSpecHarness } from '../open-chess-harness';

setPhoneOfflineHook(async (w, actor) => {
  const game = (await w.s.read(multiplayerView, actor)).game;
  if (game !== null) w.memo.set(`multiplayer:offline-board:${actor}`, game);
});

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useHarnessWorld(openSpecHarness, (w) => ({
  beforePhoneOffline: (actor: Actor) => rememberOfflineBoard(w, actor),
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
    // A saved custom feed target, two steps up.
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedMode, actor, 'custom');
    await w.s.apply(bumpPuzzleFeedCustomRating, actor, 2);
    await w.s.apply(closePuzzleFeedSettings, actor);
    remember(
      w,
      'deleted-feed-target',
      await w.s.read(readFeedTargetLabel, actor)
    );
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
  },
}));

import { proveAccount } from '@libs/account-privacy-harness/privacy-actions';
import {
  bumpPuzzleFeedCustomRating,
  closePuzzleFeedSettings,
  leaveChessStatsScreen,
  openPuzzleFeedSettings,
  openPuzzleFromSpace,
  playUntilSolved,
  setPuzzleFeedMode,
  showChessStatsScreen,
} from '@libs/chess-puzzle-harness/chess-actions';
import { readFeedTargetLabel } from '@libs/chess-puzzle-harness/chess-puzzle-feed-ui';
import {
  readStatsElo,
  readStatsRatingLabel,
  readStatsSolved,
} from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { seedPuzzleRating } from '@libs/chess-puzzle-harness/chess-rating-data';
import {
  PUZZLE_RATING_DEFAULT_VOLATILITY_MICROS,
  PUZZLE_RATING_RD_MIN,
} from '@libs/chess-puzzle-shared/chess-puzzle-rating';
import type { Actor } from '@libs/harness/parameter-types';
import { remember } from '@libs/harness/spec-world';

import './multiplayer-game.steps';
import './multiplayer-recovery.steps';
import './multiplayer-accessibility.steps';
import './multiplayer-account.steps';
import './multiplayer-policies.steps';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { rememberOfflineBoard } from './multiplayer-connection';
