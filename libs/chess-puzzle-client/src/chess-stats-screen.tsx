import {
  CHESS_SCREEN,
  SetChessSelectedReviewPuzzle,
} from '@libs/chess-root-shared/chess-screens';
import { PuzzleStatsBody } from '@libs/game-puzzle-client/puzzle-stats-body';
import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared/stats';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client/use-game-screen';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import type { JSX } from 'solid-js';

export function ChessStatsScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const gameScreen = useGameScreen();

  const backToRoot = (): void => {
    gameScreen.showChoices();
  };

  const openReview = (entry: PuzzleGameLogEntry): void => {
    dispatch(
      SetChessSelectedReviewPuzzle({
        puzzleId: entry.puzzleId,
        solveIdx: 0,
      })
    );
    gameScreen.show(CHESS_SCREEN.statsReview);
  };

  return (
    <>
      <DefineBackButton onPress={backToRoot} />
      <PuzzleStatsBody onSelectEntry={openReview} />
    </>
  );
}
