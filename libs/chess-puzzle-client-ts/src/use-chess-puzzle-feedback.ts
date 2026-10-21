import { createChessBoardSounds } from '@pkgs/chess-board-root-client-ts/chess-board-sounds';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';

import { useChessPuzzleSounds } from './use-chess-puzzle-sounds';

/** Chess's sounds for an attempt's moments; the platform adds the haptics. */
export function useChessPuzzleFeedback(): {
  onCorrectMove: () => void;
  onWrongMove: () => void;
  onSolved: () => void;
  onRatingComplete: (delta: number) => void;
} {
  const sounds = useSoundsPreference();
  const boardSounds = createChessBoardSounds(() => !sounds.muted());
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
