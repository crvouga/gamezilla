import type { ChessPuzzleGameLogEntry } from '@libs/chess-puzzle-shared/chess-puzzle-stats';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
  SetChessSelectedReviewPuzzle,
} from '@libs/chess-root-shared/chess-main-menu';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import type { JSX } from 'solid-js';
import { ChessStatsBody } from './chess-stats-body';

export function ChessStatsScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();

  const backToRoot = (): void => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  };

  const openReview = (entry: ChessPuzzleGameLogEntry): void => {
    dispatch(
      SetChessSelectedReviewPuzzle({
        puzzleId: entry.puzzleId,
        solveIdx: 0,
      })
    );
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.statsReview }));
  };

  return (
    <>
      <DefineBackButton onPress={backToRoot} />
      <ChessStatsBody onSelectEntry={openReview} />
    </>
  );
}
