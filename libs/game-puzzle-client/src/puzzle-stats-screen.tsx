import { SelectReviewPuzzle } from '@libs/game-puzzle-shared/puzzle-review-selection';
import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared/stats';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client/use-game-screen';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import type { JSX } from 'solid-js';
import { PUZZLE_SCREEN } from './puzzle-screens';
import { PuzzleStatsBody } from './puzzle-stats-body';

export function PuzzleStatsScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const gameScreen = useGameScreen();

  const backToRoot = (): void => {
    gameScreen.showChoices();
  };

  const openReview = (entry: PuzzleGameLogEntry): void => {
    dispatch(
      SelectReviewPuzzle({
        puzzleId: entry.puzzleId,
        solveIdx: 0,
      })
    );
    gameScreen.show(PUZZLE_SCREEN.review);
  };

  return (
    <>
      <DefineBackButton onPress={backToRoot} />
      <PuzzleStatsBody onSelectEntry={openReview} />
    </>
  );
}
