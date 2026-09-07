import { createChessBoardSounds } from '@pkgs/chess-board/chess-board-sounds';

import { useChessPuzzleSounds } from './use-chess-puzzle-sounds';

export function useChessPuzzleFeedback(): {
  onCorrectMove: () => void;
  onWrongMove: () => void;
  onSolved: () => void;
  onEloTick: () => void;
  onEloComplete: (delta: number) => void;
} {
  const boardSounds = createChessBoardSounds();
  const puzzleSounds = useChessPuzzleSounds();

  const onCorrectMove = (): void => {
    puzzleSounds.playCorrectMove();
  };

  const onWrongMove = (): void => {
    boardSounds.playIllegal();
  };

  const onSolved = (): void => {
    puzzleSounds.playSolved();
  };

  const onEloTick = (): void => {
    puzzleSounds.playEloTick();
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

  return { onCorrectMove, onWrongMove, onSolved, onEloTick, onEloComplete };
}
