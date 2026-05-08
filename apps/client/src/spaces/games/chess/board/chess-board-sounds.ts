import { useAudioPlayer } from 'expo-audio';
import { useCallback, useMemo } from 'react';

const moveSrc = require('../../../../../assets/sounds/spaces/games/chess/move-2.wav');
const captureSrc = require('../../../../../assets/sounds/spaces/games/chess/capture-2.wav');
const checkSrc = require('../../../../../assets/sounds/spaces/games/chess/check-2.wav');
const castleSrc = require('../../../../../assets/sounds/spaces/games/chess/castling-2.wav');
const promoteSrc = require('../../../../../assets/sounds/spaces/games/chess/ui_unlock.wav');
const illegalSrc = require('../../../../../assets/sounds/spaces/games/chess/navigation-cancel.wav');
const gameEndSrc = require('../../../../../assets/sounds/spaces/games/chess/game-over.wav');

async function playFromStart(player: {
  seekTo: (s: number) => Promise<void>;
  play: () => void;
}) {
  try {
    await player.seekTo(0);
  } catch {
    // seek can fail before load; still try play
  }
  player.play();
}

export function useChessBoardSounds() {
  const move = useAudioPlayer(moveSrc);
  const capture = useAudioPlayer(captureSrc);
  const check = useAudioPlayer(checkSrc);
  const castle = useAudioPlayer(castleSrc);
  const promote = useAudioPlayer(promoteSrc);
  const illegal = useAudioPlayer(illegalSrc);
  const gameEnd = useAudioPlayer(gameEndSrc);

  const playMove = useCallback(() => void playFromStart(move), [move]);
  const playCapture = useCallback(() => void playFromStart(capture), [capture]);
  const playCheck = useCallback(() => void playFromStart(check), [check]);
  const playCastle = useCallback(() => void playFromStart(castle), [castle]);
  const playPromote = useCallback(() => void playFromStart(promote), [promote]);
  const playIllegal = useCallback(() => void playFromStart(illegal), [illegal]);
  const playGameEnd = useCallback(() => void playFromStart(gameEnd), [gameEnd]);

  return useMemo(
    () => ({
      playMove,
      playCapture,
      playCheck,
      playCastle,
      playPromote,
      playIllegal,
      playGameEnd,
    }),
    [
      playMove,
      playCapture,
      playCheck,
      playCastle,
      playPromote,
      playIllegal,
      playGameEnd,
    ]
  );
}
