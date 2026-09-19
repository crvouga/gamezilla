import { createChessBoardSounds } from '@pkgs/chess-board/chess-board-sounds';
import { useHaptics } from '@pkgs/device/solid';

import { useChessPuzzleSounds } from './use-chess-puzzle-sounds';

export function useChessPuzzleFeedback(): {
  onCorrectMove: () => void;
  onWrongMove: () => void;
  onSolved: () => void;
  onEloComplete: (delta: number) => void;
} {
  const boardSounds = createChessBoardSounds();
  const puzzleSounds = useChessPuzzleSounds();
  const haptics = useHaptics();

  const onCorrectMove = (): void => {
    puzzleSounds.playCorrectMove();
  };

  const onWrongMove = (): void => {
    boardSounds.playIllegal();
    haptics.error();
  };

  const onSolved = (): void => {
    puzzleSounds.playSolved();
    haptics.success();
  };

  const onEloComplete = (delta: number): void => {
    if (delta > 0) {
      puzzleSounds.playEloCompleteGain();
      return;
    }
    if (delta < 0) {
      puzzleSounds.playEloCompleteLoss();
    }
  };

  return { onCorrectMove, onWrongMove, onSolved, onEloComplete };
}
