import { createChessBoardSounds } from '@pkgs/chess-board-root-client/chess-board-sounds';
import { useHaptics } from '@pkgs/device-client/solid';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';

import { useChessPuzzleSounds } from './use-chess-puzzle-sounds';

export function useChessPuzzleFeedback(): {
  onCorrectMove: () => void;
  onWrongMove: () => void;
  onSolved: () => void;
  onRatingComplete: (delta: number) => void;
} {
  const sounds = useSoundsPreference();
  const boardSounds = createChessBoardSounds(() => !sounds.muted());
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

  const onRatingComplete = (delta: number): void => {
    if (delta > 0) {
      puzzleSounds.playEloCompleteGain();
      return;
    }
    if (delta < 0) {
      puzzleSounds.playEloCompleteLoss();
    }
  };

  return { onCorrectMove, onWrongMove, onSolved, onRatingComplete };
}
