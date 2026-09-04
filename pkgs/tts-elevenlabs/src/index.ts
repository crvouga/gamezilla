/**
 * ElevenLabs provider for `@pkgs/tts` — `/text-to-speech/{voice_id}`, plus the
 * pre-wired Hono sub-app that loads ElevenLabs credentials from a
 * `SecretStore` and caches audio in an `ObjectStore`.
 */

export {
  type CreateTtsAppFromBindingsOptions,
  type CreateTtsAppFromBindingsResult,
  createTtsAppFromBindings,
  TtsSecretName,
} from './create-tts-app-from-bindings';
export {
  ElevenLabsTtsProvider,
  type ElevenLabsTtsProviderOptions,
} from './elevenlabs-tts-provider';
