import { ChessBoard } from '@pkgs/chess-board/chess-board';
import { Box } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import { ChessPuzzleBoardFrame } from './chess-puzzle-board-frame';
import { ChessPuzzleBoardLoadingState } from './chess-puzzle-board-loading-state';
import { ChessPuzzleMoveHistory } from './chess-puzzle-move-history';
import {
  type PuzzleReviewBoardModel,
  usePuzzleReviewBoard,
} from './use-puzzle-review-board';

function ReviewBoardSlot({
  size,
  model,
}: {
  size: number;
  model: PuzzleReviewBoardModel;
}): ReactNode {
  if (!model.ready) {
    return <ChessPuzzleBoardLoadingState size={size} />;
  }
  return (
    <ChessBoard
      controlled
      testID="chess-puzzle-review-board"
      size={size}
      fen={model.displayFen}
      fenSyncKey={model.solveIdx}
      orientation={model.orientation}
      interactive={false}
      showCoordinates
      highlightLastMove
    />
  );
}

export function ChessPuzzleReviewBoard(props: {
  fen: string;
  moves: string;
}): ReactNode {
  const model = usePuzzleReviewBoard(props.fen, props.moves);
  return (
    <Box sx={{ flex: 1, minHeight: 0, alignSelf: 'stretch', gap: 2 }}>
      <ChessPuzzleBoardFrame>
        {(size) => <ReviewBoardSlot size={size} model={model} />}
      </ChessPuzzleBoardFrame>
      <ChessPuzzleMoveHistory
        plies={model.plies}
        selectedSolveIdx={model.solveIdx}
        interactive={model.ready}
        onSeek={model.onSeek}
      />
    </Box>
  );
}
