import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared-ts/stats';
import type { JSX } from 'solid-js';
import { PuzzleStatsScreenView } from './puzzle-stats-screen-view';
import { usePuzzleHistory } from './use-puzzle-history';

/** Puzzle stats wired to the player's synced history. */
export function PuzzleStatsBody(props: {
  readonly onSelectEntry: (entry: PuzzleGameLogEntry) => void;
  /** See `PuzzleStatsScreenViewProps.titled`. */
  readonly titled?: boolean | undefined;
  /** See `PuzzleStatsScreenViewProps.nested`. */
  readonly nested?: boolean | undefined;
}): JSX.Element {
  const history = usePuzzleHistory();
  return (
    <PuzzleStatsScreenView
      status={history.loading() ? 'loading' : 'ready'}
      stats={history.stats()}
      gameLog={history.gameLog()}
      onSelectEntry={props.onSelectEntry}
      titled={props.titled}
      nested={props.nested}
    />
  );
}
