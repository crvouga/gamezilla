import { useChessBoardSounds } from '@pkgs/chess-board/chess-board-sounds';
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
} from '@pkgs/chess-board/chess-board-haptics';
import { useCallback, useMemo } from 'react';

import { useChessPuzzleSounds } from './use-chess-puzzle-sounds';

export function useChessPuzzleFeedback(): {
  onCorrectMove: () => void;
  onWrongMove: () => void;
  onSolved: () => void;
  onEloTick: () => void;
  onEloComplete: (delta: number) => void;
} {
  const boardSounds = useChessBoardSounds();
  const puzzleSounds = useChessPuzzleSounds();

  const onCorrectMove = useCallback(() => {
    puzzleSounds.playCorrectMove();
    hapticSelection();
  }, [puzzleSounds]);

  const onWrongMove = useCallback(() => {
    boardSounds.playIllegal();
    hapticError();
  }, [boardSounds]);

  const onSolved = useCallback(() => {
    puzzleSounds.playSolved();
    hapticSuccess();
  }, [puzzleSounds]);

  const onEloTick = useCallback(() => {
    puzzleSounds.playEloTick();
  }, [puzzleSounds]);

  const onEloComplete = useCallback(
    (delta: number) => {
      if (delta > 0) {
        puzzleSounds.playEloCompleteGain();
        hapticSuccess();
        return;
      }
      if (delta < 0) {
        puzzleSounds.playEloCompleteLoss();
      }
    },
    [puzzleSounds]
  );

  return useMemo(
    () => ({
      onCorrectMove,
      onWrongMove,
      onSolved,
      onEloTick,
      onEloComplete,
    }),
    [onCorrectMove, onEloComplete, onEloTick, onSolved, onWrongMove]
  );
}
