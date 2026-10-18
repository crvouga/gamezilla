import { chessMoveNotationOf } from '@libs/chess-puzzle-shared/chess-puzzle-notation';
import { BOARD_THEME } from '@libs/chess-root-shared/board-theme';
import { PuzzleBoardFrame } from '@libs/game-puzzle-client/puzzle-board-frame';
import { PuzzleBoardLoadingState } from '@libs/game-puzzle-client/puzzle-board-loading-state';
import { usePuzzleFeedConfig } from '@libs/game-puzzle-client/use-puzzle-feed-config';
import { puzzleNavIntentFromKey } from '@libs/game-puzzle-shared/puzzle-nav';
import { puzzleSwipeHandlers } from '@libs/game-puzzle-shared/puzzle-swipe-handlers';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import { registerFeedbackContext } from '@pkgs/feedback-shared/context';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { useDocumentShortcuts } from '@pkgs/ui-root-client/use-document-shortcuts';
import { type JSX, onCleanup, Show } from 'solid-js';
import { ChessPuzzleMoveHistory } from './chess-puzzle-move-history';
import { ChessPuzzleReviewTest } from './chess-puzzle-review-test';
import type {
  PuzzleReviewBoardModel,
  PuzzleReviewCursor,
} from './use-puzzle-review-board';
import { usePuzzleReviewBoard } from './use-puzzle-review-board';

function ReviewBoardSurface(props: {
  model: PuzzleReviewBoardModel;
}): JSX.Element {
  const sounds = useSoundsPreference();
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
            <ChessBoard
              theme={BOARD_THEME}
              sound={!sounds.muted()}
              dataSet={{ testid: 'chess-puzzle-review-board' }}
              size={size}
              fen={model.displayFen()}
              fenSyncKey={model.solveIdx()}
              orientation={model.orientation()}
              interactive={false}
              animations={model.animated()}
              showCoordinates
              highlightLastMove
            />
          </Show>
        )}
      </PuzzleBoardFrame>
    </div>
  );
}

export function ChessPuzzleReviewBoard(props: {
  fen: string;
  moves: string;
  cursor: PuzzleReviewCursor;
}): JSX.Element {
  const model = usePuzzleReviewBoard(props.fen, props.moves, props.cursor);
  const [config] = usePuzzleFeedConfig();
  onCleanup(
    registerFeedbackContext({
      name: 'chess-puzzle-review',
      collect: () => ({
        initialFen: props.fen,
        solutionMoves: props.moves,
        displayFen: model.displayFen(),
        solveIndex: model.solveIdx(),
        orientation: model.orientation(),
        animated: model.animated(),
        notation: config().notation,
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
      <ChessPuzzleMoveHistory
        plies={model.plies()}
        selectedSolveIdx={model.solveIdx()}
        interactive={model.ready()}
        notation={chessMoveNotationOf(config().notation)}
        onSeek={model.onSeek}
        nav={{
          canGoBack: model.canGoBack(),
          canGoForward: model.canGoForward(),
          showStepControls: true,
          onNavigate: model.onNavigate,
        }}
      />
      <ChessPuzzleReviewTest
        solveIdx={model.solveIdx}
        lastSolveIdx={model.lastSolveIdx}
        animated={model.animated}
        notation={() => chessMoveNotationOf(config().notation)}
        displayFen={model.displayFen}
      />
    </div>
  );
}
