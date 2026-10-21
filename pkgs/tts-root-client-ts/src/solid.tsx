/** @jsxImportSource solid-js */
import { useHttpClient } from '@pkgs/http-client-client-ts/solid';
import { useObjectStore } from '@pkgs/object-store-root-client-ts/solid';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import { createSubscriptionSignal } from '@pkgs/solid-context-client-ts/subscription-signal';
import { useAudioPlaybackPort } from '@pkgs/sounds-client-ts/solid';
import type {
  TtsAudioFormat,
  TtsSynthesizeResponse,
} from '@pkgs/tts-root-shared-ts/tts-types';
import type { Voice } from '@pkgs/tts-root-shared-ts/tts-voice';
import { DEFAULT_TTS_VOICE } from '@pkgs/tts-root-shared-ts/tts-voice';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  type ParentProps,
  untrack,
} from 'solid-js';
import { playSynthesized } from './play-synthesized';
import { TtsClient } from './tts-client';
import type { TtsPlayerSnapshot } from './tts-player-controller';
import { createTtsPlayerController } from './tts-player-controller';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type TtsArgs = {
  readonly text: string;
  readonly voice: Voice;
  readonly format: TtsAudioFormat;
  readonly signal: AbortSignal;
};

export type TtsCurrent = { readonly text: string; readonly url: string };

export type TtsApi = {
  /** Resolve `args.text` to a synthesised audio URL (cache-aware). */
  readonly synthesize: (args: TtsArgs) => Promise<TtsSynthesizeResponse>;
  /** Synthesise but don't play — primes the server cache for an upcoming `play`. */
  readonly prefetch: (args: TtsArgs) => Promise<TtsSynthesizeResponse>;
  /** Synthesise (or cache-hit) then play through the audio port. */
  readonly play: (args: TtsArgs) => Promise<void>;
  /** Stop playback if currently playing. */
  readonly stop: () => void;
  readonly isPlaying: Accessor<boolean>;
  readonly current: Accessor<TtsCurrent | null>;
  /** Length of the loaded audio in ms, or `null` when not yet known. */
  readonly durationMs: Accessor<number | null>;
};

const TtsContext = defineContext<TtsApi>('Tts');

export type TtsProviderProps = ParentProps<{
  /** Origin of the API Worker, e.g. `https://api.example.com`. */
  readonly apiUrl: string;
  /** Optional fetch override (for adding `Authorization` headers, etc.). */
  readonly fetch?: FetchFn;
}>;

/**
 * Mounts the TTS context. Wrap once near the app root; children use
 * {@link useTts}. Voice and format are per-call so each component owns its
 * own `Voice` choice.
 */
export function TtsProvider(props: TtsProviderProps): JSX.Element {
  const objectStore = useObjectStore();
  const http = useHttpClient();
  const audio = useAudioPlaybackPort();
  // Composition-root configuration: read once, not tracked.
  const client = untrack(
    () =>
      new TtsClient({
        apiUrl: props.apiUrl,
        objectStore,
        fetch: props.fetch ?? http.fetch.bind(http),
      })
  );
  const player = createTtsPlayerController({ audio });
  onCleanup(() => player.dispose());
  const snapshot = createSubscriptionSignal<TtsPlayerSnapshot>(player);
  const [currentText, setCurrentText] = createSignal<string | null>(null);

  const synthesize = (args: TtsArgs) =>
    client.synthesize({
      text: args.text,
      voice: args.voice,
      format: args.format,
      signal: args.signal,
    });

  const current = createMemo<TtsCurrent | null>(() => {
    const url = snapshot().currentUrl;
    const text = currentText();
    return url !== null && text !== null ? { text, url } : null;
  });
  const api: TtsApi = {
    synthesize,
    prefetch: synthesize,
    play: (args) =>
      playSynthesized(args, synthesize, async (result) => {
        setCurrentText(args.text);
        await player.play(result.url);
      }),
    stop: player.stop,
    isPlaying: () => snapshot().isPlaying,
    current,
    durationMs: () => snapshot().durationMs,
  };

  return (
    <TtsContext.Provider value={api}>{props.children}</TtsContext.Provider>
  );
}

export function useTts(): TtsApi {
  return TtsContext.use();
}

export type SpeakArgs = {
  /** Text to speak. Empty / whitespace-only strings are skipped. */
  readonly text: string;
  /** Identity of the position or document this utterance describes. */
  readonly contextKey?: string | undefined;
  /** Voice to speak with. Defaults to {@link DEFAULT_TTS_VOICE}. */
  readonly voice?: Voice;
  /** Audio container format. Defaults to `'mp3'`. */
  readonly format?: TtsAudioFormat;
  /** When `false`, skips synthesis and playback entirely. Defaults to `true`. */
  readonly enabled?: boolean;
};

export type SpeakResult = {
  /** Audio is being synthesised or loaded; nothing audible yet. */
  readonly isLoading: Accessor<boolean>;
  /** Audio for `text` is currently playing through the provider. */
  readonly isSpeaking: Accessor<boolean>;
  /** Audio length in ms, latched once playback starts; `null` otherwise. */
  readonly durationMs: Accessor<number | null>;
};

/**
 * Declarative TTS: speaks `args().text` whenever it changes. Each distinct
 * value is spoken exactly once; switching mid-utterance aborts the prior
 * synthesize fetch and stops audio already playing. Flipping `enabled` to
 * `false` interrupts playback.
 */
export function createSpeak(args: Accessor<SpeakArgs>): SpeakResult {
  const tts = useTts();
  const text = createMemo(() => args().text);
  const enabled = createMemo(() => args().enabled ?? true);
  const contextKey = createMemo(() => args().contextKey ?? '');
  const [isLoading, setIsLoading] = createSignal(false);
  const [durationMs, setDurationMs] = createSignal<number | null>(null);
  let lastSpoken: string | null = null;

  createEffect(
    on([text, enabled, contextKey], ([value, on_, contextKey]) => {
      if (!on_ || value.trim().length === 0) {
        lastSpoken = null;
        setIsLoading(false);
        setDurationMs(null);
        return;
      }
      const utteranceKey = `${contextKey}\u0000${value}`;
      if (lastSpoken === utteranceKey) return;
      lastSpoken = utteranceKey;
      setIsLoading(true);
      setDurationMs(null);
      const controller = new AbortController();
      void tts
        .play({
          text: value,
          voice: args().voice ?? DEFAULT_TTS_VOICE,
          format: args().format ?? 'mp3',
          signal: controller.signal,
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setIsLoading(false);
        });
      onCleanup(() => {
        controller.abort();
        tts.stop();
      });
    })
  );

  const isSpeaking = createMemo(
    () => tts.current()?.text === text() && tts.isPlaying()
  );

  // Latch the duration exactly once at the leading edge of playback.
  createEffect(() => {
    if (!isSpeaking()) return;
    if (!isLoading()) return;
    setIsLoading(false);
    setDurationMs(tts.durationMs());
  });

  return { isLoading, isSpeaking, durationMs };
}
