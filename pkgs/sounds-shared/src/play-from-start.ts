import { playAudioOrIgnoreAutoplayBlock } from './safe-audio-play';

export type PlayableAudioPlayer = {
  seekTo: (seconds: number) => Promise<void>;
  play: () => void;
  pause?: () => void;
};

export type PlayFromStartHandle = {
  play: () => void;
  cancel: () => void;
};

/**
 * Pause → seek → play with generation cancel. Survives released-SharedObject
 * races from Fast Refresh / remount between `await seekTo` and `play()`.
 */
export function createPlayFromStart(
  getPlayer: () => PlayableAudioPlayer
): PlayFromStartHandle {
  let generation = 0;
  return {
    cancel: () => {
      generation += 1;
    },
    play: () => {
      const myGen = ++generation;
      const player = getPlayer();
      void (async () => {
        try {
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
          playAudioOrIgnoreAutoplayBlock(() => getPlayer().play());
        } catch {
          // Released SharedObject / unload races (Fast Refresh, remount).
        }
      })();
    },
  };
}
