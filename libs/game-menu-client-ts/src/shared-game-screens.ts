import { SHARED_MATCHMAKING_SCREEN } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import { PUZZLE_SCREEN } from '@libs/game-puzzle-client-ts/puzzle-screens';
import {
  VS_BOT_SCREEN,
  VS_HUMAN_SCREEN,
} from '@libs/game-session-shared-ts/game-session-state';

/**
 * The screens the platform owns, by the capability that offers each, named
 * as the screens are (`<Mode>Home`, see `GAME_SCREENS.md`). The values are
 * the space-wide game screen (`useGameScreen`): synced room state every
 * device in a space reads, so a value never changes once shipped; only the
 * names in code follow the screen names.
 */
export const SHARED_GAME_SCREEN = {
  puzzlePacksHome: 'puzzle-library',
  puzzlesHome: PUZZLE_SCREEN.puzzle,
  puzzleStats: PUZZLE_SCREEN.stats,
  puzzleReview: PUZZLE_SCREEN.review,
  vsHuman: VS_HUMAN_SCREEN,
  vsBot: VS_BOT_SCREEN,
  matchmakingHome: SHARED_MATCHMAKING_SCREEN,
  /** History and stats: the games' history, or a hub when puzzle stats join it. */
  historyHome: 'history',
  /** The games' history, behind the hub when the game also offers puzzles. */
  historyGames: 'game-history',
  settings: 'settings',
} as const;
