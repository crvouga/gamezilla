import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { PuzzleActionBar } from './puzzle-action-bar';
import { PuzzleBoardFrame } from './puzzle-board-frame';
import { PuzzleMoveHistory } from './puzzle-move-history';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';

/**
 * Under the line's board: once the puzzle is over, what its solve state
 * allows (the next puzzle, a retry); while it is being solved, the way
 * back to solving it.
 */
function LineActions(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <StackVertical paddingX="lg">
      <Show
        when={props.stage === 'finished'}
        fallback={
          <StackHorizontal>
            <Button
              title={<Trans>Back to the puzzle</Trans>}
              intent="neutral"
              variant="outline"
              onClick={() => props.onBack()}
              dataSet={{ testid: 'chess-puzzle-line-close' }}
            />
          </StackHorizontal>
        }
      >
        <PuzzleActionBar
          status={props.status}
          hintStage={props.hintStage}
          canGoForward={props.canGoForward}
          onHint={props.onHint}
          onSolution={props.onSolution}
          onRetry={props.onRetry}
          onSkip={props.onSkip}
          onNext={props.onNext}
        />
      </Show>
    </StackVertical>
  );
}

/**
 * The `line` place: step through the moves played. The board shows the
 * chosen move, never taking one; the move list has the step and jump
 * controls, and a sideways swipe over it steps too.
 */
export function PuzzlePlayLineView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <PuzzleBoardFrame
      screenId="chess-puzzle-line"
      view={props}
      actions={<LineActions {...props} />}
      timeline={
        <PuzzleMoveHistory
          plies={props.line.plies}
          selectedSolveIdx={props.line.selectedSolveIdx}
          interactive={props.line.interactive}
          writing={props.line.writing}
          onSeek={props.line.onSeek}
          awaiting={props.line.awaiting}
          nav={props.line.nav}
        />
      }
    />
  );
}
