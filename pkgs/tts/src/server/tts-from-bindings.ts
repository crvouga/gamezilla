import type { ObjectStore } from '@pkgs/object-store/interface';
import { ObjectStorePrefix } from '@pkgs/object-store/prefixes';
import type { SecretStore } from '@pkgs/secret-store';
import { ElevenLabsTtsProvider } from './adapters/elevenlabs-tts-provider';
import { createTtsApp, type TtsRequireAuth } from './tts-routes';

export const TtsSecretName = {
  elevenLabsApiKey: 'ELEVEN_LABS_API_KEY',
} as const;

export type CreateTtsAppFromBindingsOptions = {
  readonly secretStore: SecretStore;
  readonly objectStore: ObjectStore;
  readonly requireAuth: TtsRequireAuth;
};

export async function createTtsAppFromBindings(
  options: CreateTtsAppFromBindingsOptions
): Promise<ReturnType<typeof createTtsApp>> {
  const apiKey = (
    await options.secretStore.getRequired(TtsSecretName.elevenLabsApiKey)
  ).readSecretValue();

  const provider = new ElevenLabsTtsProvider({ apiKey });

  return createTtsApp({
    provider,
    objectStore: options.objectStore.withPrefix(ObjectStorePrefix.ttsAudio),
    requireAuth: options.requireAuth,
  });
}
