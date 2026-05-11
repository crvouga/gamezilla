import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type {
  TtsAudioFormat,
  TtsSynthesizeResponse,
} from '../shared/tts-types';
import { TtsClient } from './tts-client';
import { useTtsPlayer } from './use-tts-player';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type UseTtsOptions = {
  readonly voiceId?: string;
  readonly model?: string;
  readonly format?: TtsAudioFormat;
  readonly signal?: AbortSignal;
};

export type UseTtsResult = {
  /** Resolve a `text` to a synthesised audio URL (cache-aware). */
  synthesize: (
    text: string,
    opts?: UseTtsOptions
  ) => Promise<TtsSynthesizeResponse>;
  /** Synthesise but don't play — primes the server cache for an upcoming `play`. */
  prefetch: (
    text: string,
    opts?: UseTtsOptions
  ) => Promise<TtsSynthesizeResponse>;
  /** Synthesise (or cache-hit) then play through `expo-audio`. */
  play: (text: string, opts?: UseTtsOptions) => Promise<void>;
  /** Stop playback if currently playing. */
  stop: () => void;
  isPlaying: boolean;
  current: { text: string; url: string } | null;
};

type ContextValue = UseTtsResult;

const Ctx = createContext<ContextValue | null>(null);

export type TtsProviderProps = {
  /** Origin of the API Worker, e.g. `https://api.gamezilla.app`. */
  readonly apiUrl: string;
  /** Optional fetch override (for adding `Authorization` headers, etc.). */
  readonly fetch?: FetchFn;
  /** Default voice id; per-call `opts.voiceId` overrides. */
  readonly defaultVoiceId?: string;
  /** Default model id; per-call `opts.model` overrides. */
  readonly defaultModel?: string;
  /** Default audio format; per-call `opts.format` overrides. Default `'mp3'`. */
  readonly defaultFormat?: TtsAudioFormat;
  readonly children: ReactNode;
};

/**
 * Mounts the TTS context. Wrap once near the app root; child components use
 * {@link useTts} to synthesise and play audio.
 *
 * `apiUrl` should be the same origin the rest of your `@gamezilla/api` client
 * code already targets — typically resolved from the runtime config service
 * (see `useConfigService().getApiUrl()` in `packages/auth`).
 */
export function TtsProvider({
  apiUrl,
  fetch: fetchOverride,
  defaultVoiceId,
  defaultModel,
  defaultFormat,
  children,
}: TtsProviderProps): ReactNode {
  const client = useMemo(
    () =>
      new TtsClient({
        apiUrl,
        ...(fetchOverride !== undefined ? { fetch: fetchOverride } : {}),
      }),
    [apiUrl, fetchOverride]
  );

  const player = useTtsPlayer();
  const currentTextRef = useRef<string | null>(null);

  const synthesize = useCallback(
    // eslint-disable-next-line complexity
    async (text: string, opts?: UseTtsOptions) => {
      const voiceId = opts?.voiceId ?? defaultVoiceId;
      const model = opts?.model ?? defaultModel;
      return client.synthesize({
        text,
        ...(voiceId !== undefined ? { voiceId } : {}),
        ...(model !== undefined ? { model } : {}),
        format: opts?.format ?? defaultFormat ?? ('mp3' as const),
        ...(opts?.signal !== undefined ? { signal: opts.signal } : {}),
      });
    },
    [client, defaultVoiceId, defaultModel, defaultFormat]
  );

  const prefetch = useCallback(
    (text: string, opts?: UseTtsOptions) => synthesize(text, opts),
    [synthesize]
  );

  const play = useCallback(
    async (text: string, opts?: UseTtsOptions) => {
      const result = await synthesize(text, opts);
      currentTextRef.current = text;
      await player.play(result.url);
    },
    [synthesize, player]
  );

  const value = useMemo<ContextValue>(
    () => ({
      synthesize,
      prefetch,
      play,
      stop: player.stop,
      isPlaying: player.isPlaying,
      current:
        player.currentUrl !== null && currentTextRef.current !== null
          ? { text: currentTextRef.current, url: player.currentUrl }
          : null,
    }),
    [
      synthesize,
      prefetch,
      play,
      player.stop,
      player.isPlaying,
      player.currentUrl,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Hook for consuming the TTS context. Throws if rendered outside
 * a `<TtsProvider>` — same pattern as `useConfigService` / `useApiClient`.
 */
export function useTts(): UseTtsResult {
  const value = useContext(Ctx);
  if (value === null) {
    throw new Error('useTts: TtsProvider missing — wrap with <TtsProvider>');
  }
  return value;
}

/**
 * Non-throwing variant — returns `null` when no `<TtsProvider>` is mounted.
 * Use from low-level UI components that may be rendered in isolated contexts
 * (tests, design-system previews) where TTS is not available.
 */
export function useTtsOptional(): UseTtsResult | null {
  return useContext(Ctx);
}
