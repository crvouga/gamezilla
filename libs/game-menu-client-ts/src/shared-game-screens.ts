import { PUZZLE_SCREEN } from '@libs/game-puzzle-client-ts/puzzle-screens';
import { GAME_CHOICES_SCREEN } from '@libs/spaces-shared-ts/games';

/** The screens the platform owns, by the capability that offers each. */
export const SHARED_GAME_SCREEN = {
  puzzle: PUZZLE_SCREEN.puzzle,
  puzzleStats: PUZZLE_SCREEN.stats,
  puzzleReview: PUZZLE_SCREEN.review,
  customGames: 'custom-game',
  matchmaking: 'multiplayer',
  history: 'history',
  settings: 'settings',
} as const;

/** Keys a game's own screens may never take: the platform owns them. */
export const RESERVED_GAME_SCREENS: ReadonlySet<string> = new Set([
  GAME_CHOICES_SCREEN,
  ...Object.values(SHARED_GAME_SCREEN),
]);

const SCREEN_KEY = /^[a-z][a-z0-9-]{0,63}$/;

/**
 * Every screen key a game declares, checked once when it is defined: a
 * lowercase slug the space accepts, unique, and never one the platform owns.
 */
export function assertGameScreens(
  gameId: string,
  screens: readonly string[]
): void {
  const seen = new Set<string>();
  for (const screen of screens) {
    if (!SCREEN_KEY.test(screen))
      throw new Error(`${gameId}: screen "${screen}" is not a lowercase slug`);
    if (RESERVED_GAME_SCREENS.has(screen))
      throw new Error(`${gameId}: screen "${screen}" belongs to the platform`);
    if (seen.has(screen))
      throw new Error(`${gameId}: screen "${screen}" is declared twice`);
    seen.add(screen);
  }
}
