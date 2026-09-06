import {
  createContext,
  createElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from './ports';

const AudioPlaybackContext = createContext<AudioPlaybackPort | null>(null);

let defaultPort: AudioPlaybackPort | null = null;

function getDefaultPort(): AudioPlaybackPort {
  if (defaultPort === null) {
    // Lazy: keep expo-audio out of the module graph until a real wall default
    // is needed (sims always inject `port` and never hit this path).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createExpoAudioPlaybackPort } =
      require('./expo-audio-playback-port') as {
        createExpoAudioPlaybackPort: () => AudioPlaybackPort;
      };
    defaultPort = createExpoAudioPlaybackPort();
  }
  return defaultPort;
}

/** Test hook: reset the lazy Expo default (sims inject via provider). */
export function resetDefaultAudioPlaybackPortForTests(): void {
  defaultPort = null;
}

export type AudioPlaybackProviderProps = {
  children: ReactNode;
  /** Inject for sims / tests. Defaults to Expo wall adapter. */
  port?: AudioPlaybackPort;
};

export function AudioPlaybackProvider({
  children,
  port,
}: AudioPlaybackProviderProps): ReactElement {
  const value = port ?? getDefaultPort();
  return createElement(AudioPlaybackContext.Provider, { value }, children);
}

export function useAudioPlaybackPort(): AudioPlaybackPort {
  const injected = useContext(AudioPlaybackContext);
  if (injected !== null) return injected;
  return getDefaultPort();
}

/** Drop-in for `expo-audio`'s `useAudioPlayer`. */
export function useAudioPlayer(source?: unknown): AudioPlayerHandle {
  const port = useAudioPlaybackPort();
  const [player] = useState(() => port.createPlayer(source));
  useEffect(() => {
    return () => {
      try {
        player.remove();
      } catch {
        // Released SharedObject races.
      }
    };
  }, [player]);
  return player;
}

/** Drop-in for `expo-audio`'s `useAudioPlayerStatus`. */
export function useAudioPlayerStatus(
  player: AudioPlayerHandle
): AudioPlayerStatus {
  const port = useAudioPlaybackPort();
  const [status, setStatus] = useState(() => port.getStatus(player));
  useEffect(() => {
    return port.subscribeStatus(player, setStatus);
  }, [port, player]);
  return status;
}
