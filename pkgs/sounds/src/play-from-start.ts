import { playAudioOrIgnoreAutoplayBlock } from './safe-audio-play';
import { useEffect, useMemo } from 'react';

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

async function warmPlayer(player: PlayableAudioPlayer): Promise<void> {
  try {
    await player.seekTo(0);
    player.pause?.();
  } catch {
    // Ignore warmup failures; normal playback path still works.
  }
}

/** Warm players once; cancel in-flight plays on unmount / player identity change. */
export function useWarmAudioPlayers(
  players: readonly PlayableAudioPlayer[],
  handles: readonly PlayFromStartHandle[]
): void {
  useEffect(() => {
    let cancelled = false;
    async function warmAll() {
      for (const player of players) {
        if (cancelled) return;
        await warmPlayer(player);
      }
    }
    void warmAll();
    return () => {
      cancelled = true;
      for (const handle of handles) {
        handle.cancel();
      }
    };
  }, [handles, players]);
}

/**
 * Stable play handles keyed by `keys`, always reading the latest player from
 * `playersRef` so remounts don't leave stale SharedObject refs in closures.
 */
export function usePlayFromStartHandles<K extends string>(
  keys: readonly K[],
  playersRef: { readonly current: Record<K, PlayableAudioPlayer> }
): Record<K, PlayFromStartHandle> {
  return useMemo(() => {
    const handles = {} as Record<K, PlayFromStartHandle>;
    for (const key of keys) {
      handles[key] = createPlayFromStart(() => playersRef.current[key]);
    }
    return handles;
  }, [keys, playersRef]);
}
