import { useHaptics } from '@pkgs/device-client/solid';
import type { PuzzleFeedback } from './puzzle-client';
import { usePuzzleGame } from './puzzle-game-context';

const SILENT: PuzzleFeedback = {
  onCorrectMove: () => {},
  onWrongMove: () => {},
  onSolved: () => {},
  onRatingComplete: () => {},
};

/**
 * An attempt's moments as the solver feels and hears them: the success
 * haptic on a solve and the error haptic on a wrong move, for every game,
 * with the game's own sounds (silent without).
 */
export function usePuzzleFeedback(): PuzzleFeedback {
  const { client } = usePuzzleGame();
  const haptics = useHaptics();
  const sounds = client.useFeedback?.() ?? SILENT;
  return {
    onCorrectMove: sounds.onCorrectMove,
    onWrongMove: () => {
      sounds.onWrongMove();
      haptics.error();
    },
    onSolved: () => {
      sounds.onSolved();
      haptics.success();
    },
    onRatingComplete: sounds.onRatingComplete,
  };
}
