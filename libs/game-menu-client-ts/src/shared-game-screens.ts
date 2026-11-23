import { PUZZLE_SCREEN } from '@libs/game-puzzle-client-ts/puzzle-screens';

/** The screens the platform owns, by the capability that offers each. */
export const SHARED_GAME_SCREEN = {
  content: 'puzzle-library',
  puzzle: PUZZLE_SCREEN.puzzle,
  puzzleStats: PUZZLE_SCREEN.stats,
  puzzleReview: PUZZLE_SCREEN.review,
  customGames: 'custom-game',
  matchmaking: 'multiplayer',
  /** History and stats: the games' history, or a hub when puzzle stats join it. */
  history: 'history',
  /** The games' history, behind the hub when the game also offers puzzles. */
  gameHistory: 'game-history',
  settings: 'settings',
} as const;
