import type {
  PuzzleGameLogEntry,
  PuzzleStats,
} from '@libs/game-puzzle-shared-ts/stats';
import type { JSX } from 'solid-js';
import { Match, Switch } from 'solid-js';
import {
  PuzzleStatsLogView,
  PuzzleStatsSummaryView,
  PuzzleStatsTrendView,
} from './puzzle-stats-place-views';
import type { PuzzleStatsPlace, PuzzleStatsStage } from './puzzle-stats-places';

export type PuzzleStatsScreenViewProps = {
  /** Whether the player's history is known (`puzzleStatsStageOf`). */
  readonly stage: PuzzleStatsStage;
  /** The small screen shown, one the stage allows. */
  readonly place: PuzzleStatsPlace;
  readonly onOpen: (place: PuzzleStatsPlace) => void;
  /** Totals, rating and its series; read only once `ready`. */
  readonly stats: PuzzleStats;
  /** Every played puzzle, newest first. */
  readonly gameLog: readonly PuzzleGameLogEntry[];
  readonly onSelectEntry: (entry: PuzzleGameLogEntry) => void;
  /** The host's bar already names each screen, so the bodies do not repeat their titles. */
  readonly titled?: boolean | undefined;
  /** The host already scrolls and pads the page. */
  readonly nested?: boolean | undefined;
};

/**
 * Puzzle stats, presentational: one small screen at a time, chosen by the
 * place machine (`puzzle-stats-places`). `summary` has the rating, played,
 * solved and accuracy together, with rows on to `trend` (the rating over
 * time) and `log` (every puzzle played, each opening its review, the
 * space's own screen). While the history is unknown the summary shows one
 * activity indicator.
 */
export function PuzzleStatsScreenView(
  props: PuzzleStatsScreenViewProps
): JSX.Element {
  return (
    <Switch>
      <Match when={props.place.screen === 'summary'}>
        <PuzzleStatsSummaryView {...props} />
      </Match>
      <Match when={props.place.screen === 'trend'}>
        <PuzzleStatsTrendView {...props} />
      </Match>
      <Match when={props.place.screen === 'log'}>
        <PuzzleStatsLogView {...props} />
      </Match>
    </Switch>
  );
}
