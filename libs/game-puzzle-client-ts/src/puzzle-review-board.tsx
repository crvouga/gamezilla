import { puzzleNavIntentFromKey } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import { puzzleSwipeHandlers } from '@libs/game-puzzle-shared-ts/puzzle-swipe-handlers';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { registerFeedbackContext } from '@pkgs/feedback-shared-ts/context';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { BoardFit } from '@pkgs/ui-root-client-ts/board-fit';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { useDocumentShortcuts } from '@pkgs/ui-root-client-ts/use-document-shortcuts';
import { dynamic, type JSX } from '@solidjs/web';
import { createMemo, onCleanup, Show } from 'solid-js';
import type { PuzzleBoardMarks } from './puzzle-client';
import { usePuzzleGame } from './puzzle-game-context';
import { PuzzleMoveHistory } from './puzzle-move-history';
import { PuzzleReviewTest } from './puzzle-review-test';
import { usePuzzleMoveWriting } from './use-puzzle-notation';
import type {
  PuzzleReviewBoardModel,
  PuzzleReviewCursor,
} from './use-puzzle-review-board';
import { usePuzzleReviewBoard } from './use-puzzle-review-board';

const NO_MARKS: PuzzleBoardMarks = { wrong: null, hint: null, solution: null };

const ignoreAction = (): void => {};

function ReviewBoardSurface(props: {
  model: PuzzleReviewBoardModel;
  size: number;
}): JSX.Element {
  const sounds = useSoundsPreference();
  const { client } = usePuzzleGame();
  const Board = dynamic(() => client.Board);
  const model = props.model;
  return (
    <Show when={model.ready()} fallback={<LoadingState size="lg" />}>
      <Board
        mode="review"
        testId="chess-puzzle-review-board"
        size={props.size}
        position={model.displayPosition()}
        orientation={model.orientation()}
        interactive={false}
        sound={!sounds.muted()}
        setup={null}
        hand={null}
        committed={[]}
        commitment={null}
        syncKey={model.solveIdx()}
        animated={model.animated()}
        moveMs={null}
        marks={NO_MARKS}
        suggestions={[]}
        onAction={ignoreAction}
      />
    </Show>
  );
}

type ReviewedPuzzle = { readonly fen: string; readonly moves: string };

/** A review is of one puzzle: another puzzle is another board. */
export function PuzzleReviewBoard(props: {
  fen: string;
  moves: string;
  cursor: PuzzleReviewCursor;
}): JSX.Element {
  const puzzle = createMemo(
    (): ReviewedPuzzle => ({ fen: props.fen, moves: props.moves }),
    { equals: (a, b) => a.fen === b.fen && a.moves === b.moves }
  );
  return (
    <Show when={puzzle()} keyed>
      {(reviewed) => <PuzzleReview puzzle={reviewed} cursor={props.cursor} />}
    </Show>
  );
}

function PuzzleReview(props: {
  puzzle: ReviewedPuzzle;
  cursor: PuzzleReviewCursor;
}): JSX.Element {
  const { fen, moves } = props.puzzle;
  const model = usePuzzleReviewBoard(fen, moves, props.cursor);
  const writing = usePuzzleMoveWriting();
  onCleanup(
    registerFeedbackContext({
      name: 'chess-puzzle-review',
      collect: () => ({
        initialPosition: fen,
        solutionMoves: moves,
        displayPosition: model.displayPosition(),
        solveIndex: model.solveIdx(),
        orientation: model.orientation(),
        animated: model.animated(),
        notation: writing.notation(),
      }),
    })
  );

  // §7 arrow keys / Home / End. Only the review surface binds them: the play
  // board consumes the arrows itself for square-cursor navigation.
  useDocumentShortcuts({
    enabled: model.ready,
    onKeyDown: (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return undefined;
      const intent = puzzleNavIntentFromKey(ev.key);
      if (intent === null) return undefined;
      model.onNavigate(intent);
      return true;
    },
  });

  // One recognizer for the board's lifetime: it remembers where a press began.
  const swipe = puzzleSwipeHandlers(model.onNavigate);
  return (
    <BoardFit
      height="bounded"
      testId={Handles.chessPuzzleBoardFrame}
      pointer={swipe}
      footer={
        <>
          <PuzzleMoveHistory
            plies={model.plies()}
            selectedSolveIdx={model.solveIdx()}
            interactive={model.ready()}
            writing={writing}
            onSeek={model.onSeek}
            nav={{
              canGoBack: model.canGoBack(),
              canGoForward: model.canGoForward(),
              onNavigate: model.onNavigate,
            }}
          />
          <PuzzleReviewTest
            solveIdx={model.solveIdx}
            lastSolveIdx={model.lastSolveIdx}
            animated={model.animated}
            notation={writing.notation}
            displayPosition={model.displayPosition}
          />
        </>
      }
    >
      {(size) => <ReviewBoardSurface model={model} size={size} />}
    </BoardFit>
  );
}
