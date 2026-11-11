import { PUZZLE_SCREEN } from '@libs/game-puzzle-client-ts/puzzle-screens';

/** The screens the platform owns, by the capability that offers each. */
export const SHARED_GAME_SCREEN = {
  content: 'puzzle-library',
  puzzle: PUZZLE_SCREEN.puzzle,
  puzzleStats: PUZZLE_SCREEN.stats,
  puzzleReview: PUZZLE_SCREEN.review,
  customGames: 'custom-game',
  matchmaking: 'multiplayer',
  history: 'history',
  settings: 'settings',
} as const;
