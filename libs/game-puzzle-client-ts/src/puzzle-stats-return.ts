import { defineContext } from '@pkgs/solid-context-client-ts/define-context';

/**
 * What a game's puzzle frame remembers for the stats on this device: that
 * a review was opened from the game log, so leaving the review (the
 * space's own screen) returns to the log rather than the summary.
 */
export type PuzzleStatsReturn = {
  /** Set when a review is opened from the log; read once on return. */
  toLog: boolean;
};

export const PuzzleStatsReturnContext =
  defineContext<PuzzleStatsReturn>('PuzzleStatsReturn');
