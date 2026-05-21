import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Internal: cross-platform audio playback for a TTS-served URL.
 *
 * Uses `expo-audio`'s `useAudioPlayer({ uri })` which works identically on
 * web, iOS, and Android — the same API the chess board sounds use
 * (`libs/chess/src/client/chess-board/chess-board-sounds.ts`).
 *
 * Returns playback controls plus an `isPlaying` flag: true while the
 * platform reports `playing`, **or** for a brief window immediately after
 * we synchronously call `player.play()` until that first status update
 * arrives — so UI (e.g. wave animation) can align with audio starting
 * instead of lagging one frame behind `status.playing`.
 */
export type TtsPlayerState = {
  readonly isPlaying: boolean;
  readonly currentUrl: string | null;
  /**
   * Total length of the currently-loaded audio in milliseconds, or `null`
   * if not yet known (no source, still loading, or the player hasn't
   * reported a duration yet). `expo-audio` reports duration in seconds;
   * we convert here so callers can mix the value with `setTimeout` /
   * `Animated.timing` durations directly.
   */
  readonly durationMs: number | null;
  readonly play: (url: string) => Promise<void>;
  readonly stop: () => void;
};

export function useTtsPlayer(): TtsPlayerState {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  /** True from `player.play()` until `status.playing` flips true (then cleared). */
  const [playingLeadIn, setPlayingLeadIn] = useState(false);
  const player = useAudioPlayer(
    currentUrl !== null ? { uri: currentUrl } : null
  );
  const status = useAudioPlayerStatus(player);
  const requestedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (status.playing) {
      setPlayingLeadIn(false);
    }
  }, [status.playing]);

  /**
   * When the audio finishes loading the URL we asked for, kick off playback.
   * Without this, `play(url)` followed immediately by `player.play()` races
   * the source replacement and silently does nothing on first call.
   *
   * The `requestedUrlRef.current === requestedUrl` re-check inside `.finally`
   * guards against the user calling `stop()` mid-seek: `stop()` clears
   * `requestedUrlRef.current`, and without this check the queued
   * `player.play()` would fire after our pause and resume audio.
   */
  useEffect(() => {
    if (requestedUrlRef.current === null) return;
    if (currentUrl !== requestedUrlRef.current) return;
    if (status.isLoaded) {
      const requestedUrl = requestedUrlRef.current;
      void player.seekTo(0).finally(() => {
        if (requestedUrlRef.current !== requestedUrl) return;
        setPlayingLeadIn(true);
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
        if (requestedUrlRef.current !== url) return;
        setPlayingLeadIn(true);
        player.play();
        requestedUrlRef.current = null;
        return;
      }
      setCurrentUrl(url);
    },
    [currentUrl, player]
  );

  /**
   * Pause unconditionally when a source is loaded rather than gating on
   * `status.playing`. The player's status event propagates through React
   * state asynchronously, so during the window between `player.play()` and
   * the status update reflecting `playing=true`, a `stop()` request would
   * otherwise be silently dropped (the audio is _about_ to start playing
   * but `status.playing` is still `false`). Calling `pause()` on an
   * already-paused player is a no-op, so this is safe.
   *
   * Clearing `requestedUrlRef.current` first also cancels any pending
   * autoplay -- both the load-then-play effect above and the
   * `seekTo`-then-play branch in `play()` re-check the ref in their
   * `.finally` and bail out when it no longer matches.
   */
  const stop = useCallback(() => {
    requestedUrlRef.current = null;
    setPlayingLeadIn(false);
    if (currentUrl !== null) {
      player.pause();
    }
  }, [player, currentUrl]);

  const durationMs =
    status.duration > 0 ? Math.round(status.duration * 1000) : null;

  return {
    isPlaying: status.playing || playingLeadIn,
    currentUrl,
    durationMs,
    play,
    stop,
  };
}
