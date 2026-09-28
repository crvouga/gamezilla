import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { useDocumentShortcuts } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

import { puzzleNavIntentFromKey } from '../../shared/puzzle-session/puzzle-nav';
import { ChessPuzzleBoardFrame } from './chess-puzzle-board-frame';
import { ChessPuzzleBoardLoadingState } from './chess-puzzle-board-loading-state';
import { ChessPuzzleMoveHistory } from './chess-puzzle-move-history';
import { ChessPuzzleReviewTest } from './chess-puzzle-review-test';
import { puzzleSwipeHandlers } from './puzzle-swipe-handlers';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import {
  type PuzzleReviewBoardModel,
  usePuzzleReviewBoard,
} from './use-puzzle-review-board';

function ReviewBoardSurface(props: {
  model: PuzzleReviewBoardModel;
}): JSX.Element {
  const model = props.model;
  const swipe = puzzleSwipeHandlers(model.onNavigate);
  return (
    <div
      class="box self-stretch flex-1 min-h-0 min-w-0"
      onPointerDown={swipe.onPointerDown}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
    >
      <ChessPuzzleBoardFrame>
        {(size) => (
          <Show
            when={model.ready()}
            fallback={<ChessPuzzleBoardLoadingState size={size} />}
          >
            <ChessBoard
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
      </ChessPuzzleBoardFrame>
    </div>
  );
}

export function ChessPuzzleReviewBoard(props: {
  fen: string;
  moves: string;
}): JSX.Element {
  const model = usePuzzleReviewBoard(props.fen, props.moves);
  const [config] = useChessPuzzleFeedConfig();

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
        notation={config().notation}
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
        notation={() => config().notation}
        displayFen={model.displayFen}
      />
    </div>
  );
}
