/**
 * The puzzle stats' small screens and the machine that says which is shown
 * (`GAME_SCREENS.md`): the stage is whether the player's history is known,
 * the place what this device opened.
 */

import {
  defineScreenPlaces,
  type ScreenPlaces,
} from '@pkgs/turn-game-client-ts/screen-places';

/** The player's puzzle history is still unknown (`loading`) or known. */
export type PuzzleStatsStage = 'loading' | 'ready';

/**
 * `summary`: the rating and the totals; `trend`: the rating over time;
 * `log`: every puzzle played; `review`: one logged puzzle, replayed on this
 * device (the personal stats; in a space the review is the space's own
 * screen).
 */
export type PuzzleStatsPlace =
  | { readonly screen: 'summary' | 'trend' | 'log' }
  | { readonly screen: 'review'; readonly puzzleId: string };

export const PUZZLE_STATS_PLACES: ScreenPlaces<
  PuzzleStatsStage,
  PuzzleStatsPlace
> = defineScreenPlaces<PuzzleStatsStage, PuzzleStatsPlace>({
  home: {
    loading: { screen: 'summary' },
    ready: { screen: 'summary' },
  },
  screens: {
    loading: ['summary'],
    ready: ['summary', 'trend', 'log', 'review'],
  },
  // A review was opened from the log, and leads back to it.
  parent: (place) => (place.screen === 'review' ? { screen: 'log' } : null),
});

/** The stats' stage, from whether the player's history has been read. */
export function puzzleStatsStageOf(args: {
  readonly loading: boolean;
}): PuzzleStatsStage {
  return args.loading ? 'loading' : 'ready';
}
