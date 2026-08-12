// @io-wall-ok — Expo Audio wall adapter (entry-shaped).
import {
  type AudioStatus,
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';

import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from './ports';

type ExpoPlayer = ReturnType<typeof createAudioPlayer> & {
  addListener?: (
    event: string,
    listener: (status: AudioStatus) => void
  ) => { remove: () => void };
  currentStatus?: AudioStatus;
};

function mapStatus(raw: Partial<AudioStatus> | undefined): AudioPlayerStatus {
  return {
    playing: raw?.playing ?? false,
    isLoaded: raw?.isLoaded ?? false,
    duration: raw?.duration ?? 0,
    currentTime: raw?.currentTime ?? 0,
    didJustFinish: raw?.didJustFinish ?? false,
  };
}

/** Production {@link AudioPlaybackPort} backed by `expo-audio`. */
export function createExpoAudioPlaybackPort(): AudioPlaybackPort {
  return {
    createPlayer(source) {
      return createAudioPlayer(
        source as Parameters<typeof createAudioPlayer>[0]
      ) as unknown as AudioPlayerHandle;
    },
    getStatus(player) {
      const p = player as unknown as ExpoPlayer;
      return mapStatus(p.currentStatus);
    },
    subscribeStatus(player, listener) {
      const p = player as unknown as ExpoPlayer;
      if (typeof p.addListener !== 'function') {
        return () => undefined;
      }
      const sub = p.addListener('playbackStatusUpdate', (status) => {
        listener(mapStatus(status));
      });
      return () => {
        sub.remove();
      };
    },
    setAudioModeAsync: (mode) => setAudioModeAsync(mode as never),
  };
}
