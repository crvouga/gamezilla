import { playAudioOrIgnoreAutoplayBlock } from '@pkgs/ui';
import { chessSoundSources } from '@pkgs/sounds/chess-sound-sources';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useMemo } from 'react';

type PlayablePlayer = {
  seekTo: (s: number) => Promise<void>;
  play: () => void;
  pause?: () => void;
};

type WarmablePlayer = {
  seekTo: (s: number) => Promise<void>;
  pause?: () => void;
};

/**
 * Pause → seek → play. Per-player generation so rapid replays of the *same*
 * sound cancel stale seeks, while a later different sound (check after capture)
 * does not abort the primary player's pending play.
 */
function createPlayFromStart(player: PlayablePlayer): () => void {
  let generation = 0;
  return () => {
    const myGen = ++generation;
    void (async () => {
      try {
        player.pause?.();
      } catch {
        // ignore
      }
      try {
        await player.seekTo(0);
      } catch {
        // seek can fail before load; still try play
      }
      if (myGen !== generation) return;
      playAudioOrIgnoreAutoplayBlock(() => player.play());
    })();
  };
}

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

  // Stable play fns tied to current player instances (rebuilt when players change).
  const playMove = useMemo(() => createPlayFromStart(move), [move]);
  const playCapture = useMemo(() => createPlayFromStart(capture), [capture]);
  const playCheck = useMemo(() => createPlayFromStart(check), [check]);
  const playCastle = useMemo(() => createPlayFromStart(castle), [castle]);
  const playPromote = useMemo(() => createPlayFromStart(promote), [promote]);
  const playIllegal = useMemo(() => createPlayFromStart(illegal), [illegal]);
  const playGameEnd = useMemo(() => createPlayFromStart(gameEnd), [gameEnd]);

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
