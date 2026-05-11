import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Internal: cross-platform audio playback for a TTS-served URL.
 *
 * Uses `expo-audio`'s `useAudioPlayer({ uri })` which works identically on
 * web, iOS, and Android — the same API the chess board sounds use
 * (`packages/chess/src/client/chess-board/chess-board-sounds.ts`).
 *
 * Returns playback controls plus an `isPlaying` flag derived from the player's
 * own status events (no manual polling, no app-state hacks).
 */
export type TtsPlayerState = {
  readonly isPlaying: boolean;
  readonly currentUrl: string | null;
  readonly play: (url: string) => Promise<void>;
  readonly stop: () => void;
};

export function useTtsPlayer(): TtsPlayerState {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const player = useAudioPlayer(
    currentUrl !== null ? { uri: currentUrl } : null
  );
  const status = useAudioPlayerStatus(player);
  const requestedUrlRef = useRef<string | null>(null);

  /**
   * When the audio finishes loading the URL we asked for, kick off playback.
   * Without this, `play(url)` followed immediately by `player.play()` races
   * the source replacement and silently does nothing on first call.
   */
  useEffect(() => {
    if (requestedUrlRef.current === null) return;
    if (currentUrl !== requestedUrlRef.current) return;
    if (status.isLoaded) {
      void player.seekTo(0).finally(() => {
        player.play();
        requestedUrlRef.current = null;
      });
    }
  }, [status.isLoaded, currentUrl, player]);

  const play = useCallback(
    async (url: string) => {
      requestedUrlRef.current = url;
      if (currentUrl === url) {
        await player.seekTo(0);
        player.play();
        requestedUrlRef.current = null;
        return;
      }
      setCurrentUrl(url);
    },
    [currentUrl, player]
  );

  const stop = useCallback(() => {
    requestedUrlRef.current = null;
    if (status.isLoaded) {
      player.pause();
    }
  }, [player, status.isLoaded]);

  return {
    isPlaying: status.playing,
    currentUrl,
    play,
    stop,
  };
}
