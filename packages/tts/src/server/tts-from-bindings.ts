import {
  ObjectStoreImplR2,
  type R2Bucket,
} from '@gamezilla/lib/object-store/impl-r2';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import { ElevenLabsTtsProvider } from './adapters/elevenlabs-tts-provider';
import { createTtsApp, type TtsRequireAuth } from './tts-routes';

/**
 * Doppler keys read by {@link createTtsAppFromBindings}. Exported so the
 * host's secret-name registry can mirror them without duplicating string
 * literals — same pattern used by `@gamezilla/stripe/secret-keys.ts`.
 */
export const TtsDopplerKey = {
  elevenLabsApiKey: 'ELEVEN_LABS_API_KEY',
} as const;

export type CreateTtsAppFromBindingsOptions = {
  readonly secretStore: SecretStore;
  /** R2 bucket binding for cached audio blobs. */
  readonly r2Bucket: R2Bucket;
  /** Auth gate; pass the host's `sessionAuth.requireAuthContext` here. */
  readonly requireAuth: TtsRequireAuth;
};

/**
 * Pre-wired Hono sub-app for the API Worker: pulls the ElevenLabs API key
 * out of Doppler, wraps the supplied R2 binding in an
 * {@link ObjectStoreImplR2}, and mounts the {@link createTtsApp} routes.
 *
 * `ELEVEN_LABS_API_KEY` is required — the secret store crashes if it's
 * missing. There is no "TTS not enabled" path: the host either provisions
 * the secret + R2 binding for every environment that mounts this sub-app,
 * or it doesn't mount it at all.
 */
export async function createTtsAppFromBindings(
  options: CreateTtsAppFromBindingsOptions
): Promise<ReturnType<typeof createTtsApp>> {
  const apiKey = await options.secretStore.getRequired(
    TtsDopplerKey.elevenLabsApiKey
  );

  const provider = new ElevenLabsTtsProvider({ apiKey });
  const objectStore = new ObjectStoreImplR2(options.r2Bucket);

  return createTtsApp({
    provider,
    objectStore,
    requireAuth: options.requireAuth,
  });
}
