import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { type JSX, Show } from 'solid-js';

import { ChessPuzzleBoardFrame } from './chess-puzzle-board-frame';
import { ChessPuzzleBoardLoadingState } from './chess-puzzle-board-loading-state';
import { ChessPuzzleMoveHistory } from './chess-puzzle-move-history';
import { usePuzzleReviewBoard } from './use-puzzle-review-board';

export function ChessPuzzleReviewBoard(props: {
  fen: string;
  moves: string;
}): JSX.Element {
  const model = usePuzzleReviewBoard(props.fen, props.moves);
  return (
    <div
      class="box self-stretch gap-2 min-w-[0]"
      style={{ height: 'min(70vh, 480px)' }}
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
              showCoordinates
              highlightLastMove
            />
          </Show>
        )}
      </ChessPuzzleBoardFrame>
      <ChessPuzzleMoveHistory
        plies={model.plies()}
        selectedSolveIdx={model.solveIdx()}
        interactive={model.ready()}
        onSeek={model.onSeek}
      />
    </div>
  );
}
