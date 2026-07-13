import { chessSoundSources } from '@pkgs/sounds/chess-sound-sources';
import { playAudioOrIgnoreAutoplayBlock } from '@pkgs/ui';
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo } from 'react';

async function playFromStart(player: {
  seekTo: (s: number) => Promise<void>;
  play: () => void;
}): Promise<void> {
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
    // Ignore warmup failures.
  }
}

export function useChessPuzzleSounds(): {
  playSolved: () => void;
  playEloTick: () => void;
  playEloCompleteGain: () => void;
  playEloCompleteLoss: () => void;
  playCorrectMove: () => void;
} {
  const checkmate = useAudioPlayer(chessSoundSources.puzzleCheckmate);
  const eloTick = useAudioPlayer(chessSoundSources.puzzleEloTick);
  const correctMove = useAudioPlayer(chessSoundSources.puzzleCorrectMove);
  const eloCompleteGain = useAudioPlayer(chessSoundSources.promote);
  const eloCompleteLoss = useAudioPlayer(
    chessSoundSources.puzzleEloCompleteLoss
  );

  useEffect(() => {
    let cancelled = false;
    const players: WarmablePlayer[] = [
      checkmate,
      eloTick,
      correctMove,
      eloCompleteGain,
      eloCompleteLoss,
    ];
    async function warmAll(): Promise<void> {
      for (const player of players) {
        if (cancelled) return;
        await warmPlayer(player);
      }
    }
    void warmAll();
    return () => {
      cancelled = true;
    };
  }, [checkmate, correctMove, eloCompleteGain, eloCompleteLoss, eloTick]);

  const playSolved = useCallback(
    () => void playFromStart(checkmate),
    [checkmate]
  );
  const playEloTick = useCallback(() => void playFromStart(eloTick), [eloTick]);
  const playEloCompleteGain = useCallback(
    () => void playFromStart(eloCompleteGain),
    [eloCompleteGain]
  );
  const playEloCompleteLoss = useCallback(
    () => void playFromStart(eloCompleteLoss),
    [eloCompleteLoss]
  );
  const playCorrectMove = useCallback(
    () => void playFromStart(correctMove),
    [correctMove]
  );

  return useMemo(
    () => ({
      playSolved,
      playEloTick,
      playEloCompleteGain,
      playEloCompleteLoss,
      playCorrectMove,
    }),
    [
      playCorrectMove,
      playEloCompleteGain,
      playEloCompleteLoss,
      playEloTick,
      playSolved,
    ]
  );
}
