import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { BoardFit } from '@pkgs/ui-root-client-ts/board-fit';
import { createMeasure } from '@pkgs/ui-root-client-ts/measure';
import { PuzzleScreen } from '@pkgs/ui-root-client-ts/puzzle-screen';
import { createScrollTarget } from '@pkgs/ui-root-client-ts/scroll';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createEffect, type JSX, on, Show } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleStatusLine } from './puzzle-status-line';

export type PuzzleBoardFrameProps = {
  readonly screenId: string;
  readonly view: PuzzlePlayScreenViewProps;
  /** Above the status line (a watcher's allowance). */
  readonly lead?: JSX.Element;
  /** What is done about the puzzle, under the board. */
  readonly actions?: JSX.Element;
  /** The line played, and what follows it. */
  readonly timeline?: JSX.Element;
};

/**
 * A puzzle's stage: the title, the one status line, the board in the room
 * the rest leaves, and under it what the screen adds: its actions and the
 * line. The board's screens (`play`, `line`) are this frame with their own
 * actions and line.
 */
export function PuzzleBoardFrame(props: PuzzleBoardFrameProps): JSX.Element {
  const boardMeasure = createMeasure();
  const boardReveal = createScrollTarget();
  // A width-sized board scrolls with the screen, and Retry sits under the
  // wrong move's longer coaching: reaching it can scroll the board's top
  // away. Retry puts the position back to play on, so the board comes back
  // into view with it.
  createEffect(
    on(
      () => props.view.status,
      (status, before) => {
        if (before === 'wrong' && status !== 'wrong')
          boardReveal.scrollIntoView({
            behavior: 'instant',
            block: 'nearest',
            scope: 'scroller',
          });
      }
    )
  );
  return (
    <PuzzleScreen
      screenId={props.screenId}
      boardSizing={props.view.boardSizing}
      title={<Trans>Puzzles</Trans>}
      dataSet={{ testid: 'chess-puzzle-play-layout' }}
      header={
        <>
          {props.lead}
          <PuzzleStatusLine {...props.view} />
        </>
      }
      legend={props.view.legend}
      actions={props.actions}
      timeline={props.timeline}
    >
      <Show
        when={props.view.boardSizing === 'width'}
        fallback={
          <BoardFit testId={Handles.chessPuzzleBoardFrame}>
            {(size) => props.view.board?.(size)}
          </BoardFit>
        }
      >
        <StackVertical
          self="stretch"
          measureTarget={boardMeasure.target}
          scrollTarget={boardReveal.target}
          testId={Handles.chessPuzzleBoardFrame}
        >
          {props.view.board?.(boardMeasure.width())}
        </StackVertical>
      </Show>
    </PuzzleScreen>
  );
}
