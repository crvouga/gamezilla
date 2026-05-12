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
import type { Voice } from '../shared/tts-voice';
import { TtsClient } from './tts-client';
import { useTtsPlayer } from './use-tts-player';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type UseTtsOptions = {
  readonly voice: Voice;
  readonly format: TtsAudioFormat;
  readonly signal?: AbortSignal;
};

export type UseTtsResult = {
  /** Resolve a `text` to a synthesised audio URL (cache-aware). */
  synthesize: (
    text: string,
    opts: UseTtsOptions
  ) => Promise<TtsSynthesizeResponse>;
  /** Synthesise but don't play — primes the server cache for an upcoming `play`. */
  prefetch: (
    text: string,
    opts: UseTtsOptions
  ) => Promise<TtsSynthesizeResponse>;
  /** Synthesise (or cache-hit) then play through `expo-audio`. */
  play: (text: string, opts: UseTtsOptions) => Promise<void>;
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
  readonly children: ReactNode;
};

/**
 * Mounts the TTS context. Wrap once near the app root; child components use
 * {@link useTts} to synthesise and play audio. Voice and format are passed
 * per-call (no provider-wide defaults) so each component owns its own
 * `Voice` choice — the chess puzzle screen, for example, hard-codes
 * `Voices.David`.
 *
 * `apiUrl` should be the same origin the rest of your `@gamezilla/api` client
 * code already targets — typically resolved from the runtime config service
 * (see `useConfigService().getApiUrl()` in `packages/auth`).
 */
export function TtsProvider({
  apiUrl,
  fetch: fetchOverride,
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
    (text: string, opts: UseTtsOptions) =>
      client.synthesize({
        text,
        voice: opts.voice,
        format: opts.format,
        ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
      }),
    [client]
  );

  const prefetch = useCallback(
    (text: string, opts: UseTtsOptions) => synthesize(text, opts),
    [synthesize]
  );

  const play = useCallback(
    async (text: string, opts: UseTtsOptions) => {
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
