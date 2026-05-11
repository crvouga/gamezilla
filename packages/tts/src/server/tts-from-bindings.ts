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
  /** Optional override for the default voice ID (per request). */
  elevenLabsDefaultVoiceId: 'ELEVEN_LABS_DEFAULT_VOICE_ID',
  /** Optional override for the default model. Defaults to `eleven_turbo_v2_5`. */
  elevenLabsDefaultModel: 'ELEVEN_LABS_DEFAULT_MODEL',
} as const;

export type CreateTtsAppFromBindingsOptions = {
  readonly secretStore: SecretStore;
  /** R2 bucket binding for cached audio blobs. */
  readonly r2Bucket: R2Bucket;
  /** Optional auth gate; pass the host's `sessionAuth.requireAuthContext` here. */
  readonly requireAuth?: TtsRequireAuth;
};

/**
 * Pre-wired Hono sub-app for the API Worker: pulls ElevenLabs secrets out of
 * Doppler, wraps the supplied R2 binding in an {@link ObjectStoreImplR2}, and
 * mounts the {@link createTtsApp} routes.
 *
 * Returns `null` when `ELEVEN_LABS_API_KEY` is unset / blank in the configured
 * Doppler scope. Callers should treat that as "TTS not enabled in this
 * environment" and skip mounting — this lets dev environments boot without
 * having to provision an ElevenLabs key just to test other features.
 */
export async function createTtsAppFromBindings(
  options: CreateTtsAppFromBindingsOptions
): Promise<ReturnType<typeof createTtsApp> | null> {
  const apiKey = await options.secretStore.getOptional(
    TtsDopplerKey.elevenLabsApiKey
  );
  if (apiKey === null) {
    return null;
  }

  const defaultVoiceId =
    (await options.secretStore.getOptional(
      TtsDopplerKey.elevenLabsDefaultVoiceId
    )) ?? undefined;
  const defaultModel =
    (await options.secretStore.getOptional(
      TtsDopplerKey.elevenLabsDefaultModel
    )) ?? undefined;

  const provider = new ElevenLabsTtsProvider({
    apiKey,
    ...(defaultVoiceId !== undefined ? { defaultVoiceId } : {}),
    ...(defaultModel !== undefined ? { defaultModel } : {}),
  });
  const objectStore = new ObjectStoreImplR2(options.r2Bucket);

  return createTtsApp({
    provider,
    objectStore,
    ...(options.requireAuth !== undefined
      ? { requireAuth: options.requireAuth }
      : {}),
  });
}
