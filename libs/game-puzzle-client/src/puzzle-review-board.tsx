import { puzzleNavIntentFromKey } from '@libs/game-puzzle-shared/puzzle-nav';
import { puzzleSwipeHandlers } from '@libs/game-puzzle-shared/puzzle-swipe-handlers';
import { registerFeedbackContext } from '@pkgs/feedback-shared/context';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { useDocumentShortcuts } from '@pkgs/ui-root-client/use-document-shortcuts';
import { type JSX, onCleanup, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { PuzzleBoardFrame } from './puzzle-board-frame';
import { PuzzleBoardLoadingState } from './puzzle-board-loading-state';
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
}): JSX.Element {
  const sounds = useSoundsPreference();
  const { client } = usePuzzleGame();
  const model = props.model;
  const swipe = puzzleSwipeHandlers(model.onNavigate);
  return (
    <div
      class="box self-stretch flex-1 min-h-0 min-w-0"
      onPointerDown={swipe.onPointerDown}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
    >
      <PuzzleBoardFrame>
        {(size) => (
          <Show
            when={model.ready()}
            fallback={<PuzzleBoardLoadingState size={size} />}
          >
            <Dynamic
              component={client.Board}
              mode="review"
              testId="chess-puzzle-review-board"
              size={size}
              position={model.displayPosition()}
              orientation={model.orientation()}
              interactive={false}
              sound={!sounds.muted()}
              setup={null}
              syncKey={model.solveIdx()}
              animated={model.animated()}
              moveMs={null}
              marks={NO_MARKS}
              suggestions={[]}
              onAction={ignoreAction}
            />
          </Show>
        )}
      </PuzzleBoardFrame>
    </div>
  );
}

export function PuzzleReviewBoard(props: {
  fen: string;
  moves: string;
  cursor: PuzzleReviewCursor;
}): JSX.Element {
  const model = usePuzzleReviewBoard(props.fen, props.moves, props.cursor);
  const writing = usePuzzleMoveWriting();
  onCleanup(
    registerFeedbackContext({
      name: 'chess-puzzle-review',
      collect: () => ({
        initialPosition: props.fen,
        solutionMoves: props.moves,
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

  return (
    <div
      class="box self-stretch gap-2 min-w-0"
      style={{ height: 'min(70vh, 480px)' }}
    >
      <ReviewBoardSurface model={model} />
      <PuzzleMoveHistory
        plies={model.plies()}
        selectedSolveIdx={model.solveIdx()}
        interactive={model.ready()}
        writing={writing}
        onSeek={model.onSeek}
        nav={{
          canGoBack: model.canGoBack(),
          canGoForward: model.canGoForward(),
          showStepControls: true,
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
    </div>
  );
}
