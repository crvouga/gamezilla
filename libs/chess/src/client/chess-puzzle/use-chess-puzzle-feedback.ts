import { useChessBoardSounds } from '@pkgs/chess-board/chess-board-sounds';
import {
  hapticError,
  hapticSuccess,
} from '@pkgs/chess-board/chess-board-haptics';
import { useCallback, useMemo } from 'react';

export function useChessPuzzleFeedback(): {
  onCorrectMove: () => void;
  onWrongMove: () => void;
  onSolved: () => void;
  onEloTick: () => void;
} {
  const sounds = useChessBoardSounds();

  const onCorrectMove = useCallback(() => {
    sounds.playMove();
  }, [sounds]);

  const onWrongMove = useCallback(() => {
    sounds.playIllegal();
    hapticError();
  }, [sounds]);

  const onSolved = useCallback(() => {
    sounds.playGameEnd();
    hapticSuccess();
  }, [sounds]);

  const onEloTick = useCallback(() => {
    sounds.playPromote();
  }, [sounds]);

  return useMemo(
    () => ({ onCorrectMove, onWrongMove, onSolved, onEloTick }),
    [onCorrectMove, onEloTick, onSolved, onWrongMove]
  );
}
