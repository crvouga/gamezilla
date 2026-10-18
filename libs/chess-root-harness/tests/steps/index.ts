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
import { heldMatchedGame } from '@libs/game-matchmaking-harness/matched-game-world';
import { setPhoneOfflineHook } from '@libs/harness/platform';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { openSpecHarness } from '../open-chess-harness';

setPhoneOfflineHook(async (w, actor) => {
  const game = await w.s.read(heldMatchedGame, actor);
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
    await w.s.apply(seedPuzzleRating, actor, CHESS_GAME_ID, {
      rating: 1800,
      ratingDeviation: PUZZLE_RATING_SCALE.deviationFloor,
      volatilityMicros: PUZZLE_RATING_SCALE.startVolatilityMicros,
    });
    await w.s.apply(createSpace, actor);
    const customLink = await w.s.read(readSpaceLink, actor);
    await w.s.apply(openGamePuzzles, actor, CHESS_GAME_ID);
    await w.s.apply(playUntilSolved, actor);
    // A saved custom feed target, two steps up.
    await w.s.apply(openPuzzleFeedSettings, actor);
    await w.s.apply(setPuzzleFeedMode, actor, 'custom');
    await w.s.apply(raisePuzzleFeedCustomTarget, actor, 2);
    await w.s.apply(closePuzzleFeedSettings, actor);
    remember(
      w,
      'deleted-feed-target',
      await w.s.read(readFeedTargetLabel, actor)
    );
    await w.s.apply(showGamePuzzleStats, actor, CHESS_GAME_ID);
    remember(
      w,
      'deleted-puzzle-rating',
      await w.s.read(readStatsPuzzleRating, actor)
    );
    remember(
      w,
      'deleted-puzzle-label',
      await w.s.read(readStatsRatingLabel, actor)
    );
    remember(
      w,
      'deleted-puzzle-solved',
      (await w.s.read(readStatsFigures, actor)).solved
    );
    if (customLink === null) throw new Error('Deleted account has no space');
    await w.s.apply(leaveGamePuzzleStats, actor);
  },
}));

import { proveAccount } from '@libs/account-privacy-harness/privacy-actions';
import { playUntilSolved } from '@libs/chess-puzzle-harness/chess-actions';
import {
  closePuzzleFeedSettings,
  openPuzzleFeedSettings,
  raisePuzzleFeedCustomTarget,
  readFeedTargetLabel,
  setPuzzleFeedMode,
} from '@libs/game-session-harness/puzzle-feed';
import { PUZZLE_RATING_SCALE } from '@libs/game-session-harness/puzzle-fixtures';
import { seedPuzzleRating } from '@libs/game-session-harness/puzzle-pool';
import type { Actor } from '@libs/harness/parameter-types';
import { remember } from '@libs/harness/spec-world';

import './multiplayer-game.steps';
import './multiplayer-accessibility.steps';
import './multiplayer-policies.steps';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import {
  leaveGamePuzzleStats,
  readStatsFigures,
  readStatsPuzzleRating,
  readStatsRatingLabel,
  showGamePuzzleStats,
} from '@libs/game-session-harness/puzzle-records';
import { openGamePuzzles } from '@libs/game-session-harness/puzzle-screen';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { rememberOfflineBoard } from './multiplayer-connection';
