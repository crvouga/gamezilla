import { useLingui } from '@lingui/solid/macro';
import type { SpaceGameAction } from '@pkgs/ui-root-client-ts/space-types';
import type { Accessor, JSX } from 'solid-js';
import { usePuzzleSolveActions } from './puzzle-in-game-play';
import { PuzzleMoveHistory } from './puzzle-move-history';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';

/**
 * The line's action bar: once the puzzle is over, what its solve state
 * allows (the next puzzle, a retry); while it is being solved, the way
 * back to solving it.
 */
export function usePuzzleLineActions(
  view: () => PuzzlePlayScreenViewProps
): Accessor<readonly SpaceGameAction[]> {
  const { t } = useLingui();
  const over = usePuzzleSolveActions(view);
  return () =>
    view().stage === 'finished'
      ? over()
      : [
          {
            id: 'line-close',
            label: t`Back to the puzzle`,
            onPress: () => view().onBack(),
            testId: 'chess-puzzle-line-close',
          },
        ];
}

/**
 * The `line` place's moves: the move list with its step and jump controls;
 * a sideways swipe over it steps too.
 */
export function PuzzleLineMoves(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <PuzzleMoveHistory
      plies={props.line.plies}
      selectedSolveIdx={props.line.selectedSolveIdx}
      interactive={props.line.interactive}
      writing={props.line.writing}
      onSeek={props.line.onSeek}
      awaiting={props.line.awaiting}
      nav={props.line.nav}
    />
  );
}
