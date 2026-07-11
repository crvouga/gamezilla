import { playAudioOrIgnoreAutoplayBlock } from '@pkgs/ui';
import { chessSoundSources } from '@pkgs/sounds/chess-sound-sources';
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo } from 'react';

async function playFromStart(player: {
  seekTo: (s: number) => Promise<void>;
  play: () => void;
}) {
  try {
    await player.seekTo(0);
  } catch {
    // seek can fail before load; still try play
  }
  playAudioOrIgnoreAutoplayBlock(() => player.play());
}

type WarmablePlayer = {
  seekTo: (s: number) => Promise<void>;
  pause?: () => void;
};

async function warmPlayer(player: WarmablePlayer): Promise<void> {
  try {
    await player.seekTo(0);
    player.pause?.();
  } catch {
    // Ignore warmup failures; normal playback path still works.
  }
}

export function useChessBoardSounds() {
  const move = useAudioPlayer(chessSoundSources.move);
  const capture = useAudioPlayer(chessSoundSources.capture);
  const check = useAudioPlayer(chessSoundSources.check);
  const castle = useAudioPlayer(chessSoundSources.castle);
  const promote = useAudioPlayer(chessSoundSources.promote);
  const illegal = useAudioPlayer(chessSoundSources.illegal);
  const gameEnd = useAudioPlayer(chessSoundSources.gameEnd);

  useEffect(() => {
    let cancelled = false;
    const players: WarmablePlayer[] = [
      move,
      capture,
      check,
      castle,
      promote,
      illegal,
      gameEnd,
    ];
    async function warmAll() {
      for (const player of players) {
        if (cancelled) return;
        await warmPlayer(player);
      }
    }
    void warmAll();
    return () => {
      cancelled = true;
    };
  }, [castle, capture, check, gameEnd, illegal, move, promote]);

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

export type ChessBoardSounds = ReturnType<typeof useChessBoardSounds>;
