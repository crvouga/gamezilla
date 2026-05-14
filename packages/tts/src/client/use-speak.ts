/**
 * `useSpeak` — declarative TTS for components that just want a string to be
 * spoken aloud whenever it changes.
 *
 * Treats `text` as the single source of truth: each distinct value is
 * spoken exactly once, and switching to a new value mid-utterance both
 * aborts the prior in-flight `synthesize` fetch and stops any audio that
 * is already playing through `<TtsProvider>`. Re-renders that don't change
 * `text` are no-ops, so this is safe to call unconditionally from render.
 *
 * Returns per-utterance status so callers can render a loading indicator
 * while audio is being synthesised / loaded and sync their own animations
 * to the audio's real duration (e.g. typewriter reveal that finishes when
 * speech ends).
 *
 * Must be rendered beneath a `<TtsProvider>` — the underlying `useTts()`
 * throws otherwise.
 *
 * @example
 * ```tsx
 * function Coach({ message }: { message: string }) {
 *   const { isLoading, durationMs } = useSpeak({
 *     text: message,
 *     voice: DEFAULT_TTS_VOICE,
 *   });
 *   return <Bubble loading={isLoading} text={message} revealMs={durationMs} />;
 * }
 *
 * // Muted/decorative usage: hook is a no-op, status flags stay false/null.
 * useSpeak({ text: hint, voice: DEFAULT_TTS_VOICE, enabled: !muted });
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import type { TtsAudioFormat } from '../shared/tts-types';
import {
  DEFAULT_TTS_VOICE,
  type Voice,
} from '../shared/tts-voice';
import { useTts } from './tts-context';

export type UseSpeakArgs = {
  /** Text to speak. Empty / whitespace-only strings are skipped. */
  readonly text: string;
  /** Voice to speak with. Defaults to {@link DEFAULT_TTS_VOICE}. */
  readonly voice?: Voice;
  /** Audio container format. Defaults to `'mp3'`. */
  readonly format?: TtsAudioFormat;
  /**
   * When `false`, skips synthesis and playback entirely (e.g. for muted /
   * decorative usage). Defaults to `true`.
   */
  readonly enabled?: boolean;
};

export type UseSpeakResult = {
  /**
   * Audio is being synthesised or loaded; nothing audible yet. Flips to
   * `false` either when playback starts for `text` or when the underlying
   * `play()` rejects (so the UI doesn't get stuck on a loading indicator).
   */
  readonly isLoading: boolean;
  /** Audio for `text` is currently playing through the provider. */
  readonly isSpeaking: boolean;
  /**
   * Total audio length in milliseconds, available once playback starts.
   * `null` while loading, when `enabled` is `false`, or when the player
   * has not yet reported a duration.
   */
  readonly durationMs: number | null;
};

type SpeakState = {
  readonly isLoading: boolean;
  readonly durationMs: number | null;
};

function initialState(text: string, enabled: boolean): SpeakState {
  return {
    isLoading: enabled && text.trim().length > 0,
    durationMs: null,
  };
}

export function useSpeak({
  text,
  voice = DEFAULT_TTS_VOICE,
  format = 'mp3',
  enabled = true,
}: UseSpeakArgs): UseSpeakResult {
  const tts = useTts();
  /**
   * Held in refs so the playback effect can read the latest `tts`, `voice`,
   * and `format` without listing them as dependencies. `TtsProvider`'s
   * context value re-memoizes whenever `player.isPlaying`,
   * `player.currentUrl`, or `player.durationMs` changes — i.e. every time
   * _our own_ audio starts, stops, or reports a new duration — and listing
   * `tts` here would make the effect interrupt itself in a loop.
   */
  const ttsRef = useRef(tts);
  ttsRef.current = tts;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const formatRef = useRef(format);
  formatRef.current = format;
  const lastSpokenRef = useRef<string | null>(null);

  const [state, setState] = useState<SpeakState>(() =>
    initialState(text, enabled)
  );

  /**
   * Kick off TTS when the text changes — the audio fetch happens in
   * parallel with whatever visual reveal the caller renders so they finish
   * around the same time on cache hits.
   *
   * `lastSpokenRef` dedupes against React re-renders so each distinct
   * value is spoken exactly once.
   *
   * Overlap / interrupt prevention: each kept-utterance captures its
   * own `AbortController` in the cleanup closure. When the effect
   * re-runs (because `text` changed OR `enabled` flipped to `false`)
   * we
   *   1. `controller.abort()` — cancels the prior message's in-flight
   *      `synthesize` fetch so its resolved `player.play(url)` cannot
   *      fire after we've moved on, and
   *   2. `ttsRef.current.stop()` — pauses any audio currently playing
   *      from a prior message and cancels any autoplay queued by an
   *      in-flight `play()` (the player tracks the latest requested
   *      URL and bails out of its post-seek `player.play()` once we
   *      clear it). This is what makes flipping `enabled` to `false`
   *      actually interrupt audio that's already playing.
   * The two together make it impossible for a previous utterance to
   * overlap with the new one or to keep playing after the caller
   * disables the hook.
   */
  useEffect(() => {
    if (!enabled) {
      setState({ isLoading: false, durationMs: null });
      return;
    }
    if (text.trim().length === 0) {
      setState({ isLoading: false, durationMs: null });
      return;
    }
    if (lastSpokenRef.current === text) return;
    lastSpokenRef.current = text;

    setState({ isLoading: true, durationMs: null });

    const controller = new AbortController();
    void ttsRef.current
      .play({
        text,
        voice: voiceRef.current,
        format: formatRef.current,
        signal: controller.signal,
      })
      .catch(() => {
        /**
         * Synthesis or playback failed (network, aborted, etc.). Clear
         * the loading flag so the UI falls through to its non-loading
         * branch — matches the existing silent-failure semantics.
         */
        if (controller.signal.aborted) return;
        setState((prev) =>
          prev.isLoading ? { isLoading: false, durationMs: null } : prev
        );
      });

    return () => {
      controller.abort();
      ttsRef.current.stop();
    };
  }, [text, enabled]);

  /**
   * Observe the provider once playback actually starts for our text and
   * latch the audio's reported duration. Separate from the kickoff effect
   * so listing `tts.*` here is safe — this effect doesn't re-issue play.
   *
   * **Latch exactly once.** `expo-audio` typically emits two status
   * updates around `play()` resolving: first with `duration === 0`
   * (`durationMs === null`), then again a tick later once the audio
   * metadata resolves with the real duration. If we let every update
   * write through to state, `durationMs` would flip from
   * `null` → `X` mid-utterance and any caller-driven animation keyed
   * off it (e.g. a typewriter reveal synced to audio length) would
   * restart and "double-play". The `prev.isLoading` guard turns the
   * second emission into a no-op so the duration captured at the
   * leading edge of playback is the one we commit to for this
   * utterance.
   *
   * Trade-off: if the duration races behind `isPlaying` (`durationMs`
   * still `null` when playback starts), callers that want to sync to
   * audio length will see `null` for this utterance and have to fall
   * back to their own default. On native, duration is typically ready
   * before `isPlaying` flips — this only really matters on web where
   * `HTMLAudioElement.duration` can populate slightly after `playing`.
   */
  const ttsCurrentText = tts.current?.text ?? null;
  const ttsIsPlaying = tts.isPlaying;
  const ttsDurationMs = tts.durationMs;
  useEffect(() => {
    if (ttsCurrentText !== text) return;
    if (!ttsIsPlaying) return;
    setState((prev) =>
      prev.isLoading ? { isLoading: false, durationMs: ttsDurationMs } : prev
    );
  }, [ttsCurrentText, ttsIsPlaying, ttsDurationMs, text]);

  const isSpeaking = ttsCurrentText === text && ttsIsPlaying;

  return {
    isLoading: state.isLoading,
    isSpeaking,
    durationMs: state.durationMs,
  };
}
