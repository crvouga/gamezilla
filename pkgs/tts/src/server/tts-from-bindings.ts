import type { ObjectStore } from '@pkgs/object-store/interface';
import { ObjectStorePrefix } from '@pkgs/object-store/prefixes';
import type { SecretStore } from '@pkgs/secret-store';
import { Hono } from 'hono';
import { ElevenLabsTtsProvider } from './adapters/elevenlabs-tts-provider';
import type { TtsProvider } from './ports/tts-provider';
import { createTtsApp, type TtsRequireAuth } from './tts-routes';

export const TtsSecretName = {
  elevenLabsApiKey: 'ELEVEN_LABS_API_KEY',
} as const;

export type CreateTtsAppFromBindingsOptions = {
  readonly secretStore: SecretStore;
  readonly objectStore: ObjectStore;
  readonly requireAuth: TtsRequireAuth;
  readonly fetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
  readonly publicPathPrefix?: string;
  /** When set, skips secret lookup and mounts a configured app. */
  readonly provider?: TtsProvider;
};

export type CreateTtsAppFromBindingsResult = {
  readonly app: Hono;
  readonly configured: boolean;
};

function createUnconfiguredTtsApp(): Hono {
  return new Hono()
    .post('/tts/synthesize', (c) =>
      c.json({ error: 'TTS is not configured' }, 503)
    )
    .get('/tts/audio/:hashWithExt', (c) =>
      c.json({ error: 'TTS is not configured' }, 503)
    );
}

/**
 * Pre-wired Hono sub-app: loads ElevenLabs credentials from the secret store.
 * When the key is missing, mounts a degraded surface that returns 503.
 * Pass {@link CreateTtsAppFromBindingsOptions.provider} to skip secrets.
 */
export async function createTtsAppFromBindings(
  options: CreateTtsAppFromBindingsOptions
): Promise<CreateTtsAppFromBindingsResult> {
  const provider =
    options.provider ?? (await resolveElevenLabsProvider(options));
  if (provider === null) {
    return { app: createUnconfiguredTtsApp(), configured: false };
  }

  return {
    configured: true,
    app: createTtsApp({
      provider,
      objectStore: options.objectStore.withPrefix(ObjectStorePrefix.ttsAudio),
      requireAuth: options.requireAuth,
      ...(options.publicPathPrefix !== undefined
        ? { publicPathPrefix: options.publicPathPrefix }
        : {}),
    }),
  };
}

async function resolveElevenLabsProvider(
  options: CreateTtsAppFromBindingsOptions
): Promise<TtsProvider | null> {
  const raw = (
    await options.secretStore.getOptional(TtsSecretName.elevenLabsApiKey)
  )?.readSecretValue();
  const apiKey =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  if (apiKey === null) return null;
  return new ElevenLabsTtsProvider({ apiKey, fetch: options.fetch });
}
