import { Handles } from '@libs/test-ids-shared-ts/handles';
import { BoardFit } from '@pkgs/ui-root-client-ts/board-fit';
import { createMeasure } from '@pkgs/ui-root-client-ts/measure';
import { createScrollTarget } from '@pkgs/ui-root-client-ts/scroll';
import type {
  SpaceGameAction,
  SpaceGameResult,
} from '@pkgs/ui-root-client-ts/space-types';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createEffect, type JSX, on, Show } from 'solid-js';
import { PuzzleCoachLine } from './puzzle-coach-line';
import { puzzleClockDetail, usePuzzleStatusText } from './puzzle-in-game-play';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleSpaceInGame } from './puzzle-space-in-game';

export type PuzzleBoardFrameProps = {
  readonly view: PuzzlePlayScreenViewProps;
  /** Over the coach's line (a watcher's allowance). */
  readonly lead?: JSX.Element;
  /** What is read with the board, under it: the line, the result. */
  readonly body?: JSX.Element;
  /** What can be done now, on the action bar. */
  readonly actions: readonly SpaceGameAction[];
  /** What the viewer waits for when there is nothing to do. */
  readonly waiting?: string | undefined;
  /** The puzzle is over: its outcome and what next. */
  readonly result?: SpaceGameResult | undefined;
};

/** The board in the room the rest leaves, or as wide as the stage. */
function PuzzleBoard(props: {
  readonly view: PuzzlePlayScreenViewProps;
}): JSX.Element {
  const boardMeasure = createMeasure();
  const boardReveal = createScrollTarget();
  // A width-sized board scrolls with the stage, and Retry sits under the
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
  );
}

/**
 * The puzzle feed's board in the space: the status line over the board
 * (whose move it is or how the attempt stands, and the clock), then as
 * the stage the coach's line, the board in the room the rest leaves, who
 * suggested which move, and what the place reads with it; what can be
 * done is the action bar. The space host solves and everyone else
 * watches. The board's places (`play`, `line`, `result`) are this frame
 * with their own actions and body.
 */
export function PuzzleBoardFrame(props: PuzzleBoardFrameProps): JSX.Element {
  const status = usePuzzleStatusText(() => props.view);
  return (
    <PuzzleSpaceInGame
      gameKey="puzzle"
      solver="host"
      status={status()}
      statusTestId={Handles.chessPuzzleStatusLabel}
      detail={puzzleClockDetail(props.view.elapsedMs)}
      actions={props.actions}
      waiting={props.waiting}
      result={props.result}
      notice={
        <>
          {props.view.spaceNotice}
          {props.view.notices}
        </>
      }
      board={
        <StackVertical
          grow
          gap="md"
          paddingTop="sm"
          paddingBottom="lg"
          testId="chess-puzzle-play-layout"
        >
          {props.lead}
          <StackVertical paddingX="lg">
            <PuzzleCoachLine {...props.view} />
          </StackVertical>
          <PuzzleBoard view={props.view} />
          <Show when={props.view.legend}>
            <StackVertical paddingX="lg">{props.view.legend}</StackVertical>
          </Show>
          {props.body}
        </StackVertical>
      }
    />
  );
}
