/**
 * Server-side facade for `@pkgs/tts`. Hosts that just want to mount the
 * pre-wired ElevenLabs+B2 setup should import from here.
 */

export {
  DEFAULT_TTS_VOICE,
  ttsProviderIdForVoice,
  VOICE_NAMES,
  VOICE_PROVIDERS,
  VOICES,
  type Voice,
  type VoiceName,
  type VoiceProvider,
  Voices,
} from '../shared/tts-voice';
export { ElevenLabsTtsProvider } from './adapters/elevenlabs-tts-provider';
export { InMemoryTtsProvider } from './adapters/in-memory-tts-provider';
export {
  isTtsProviderError,
  type TtsProvider,
  TtsProviderError,
  type TtsSynthesizeInput,
  type TtsSynthesizeOutput,
} from './ports/tts-provider';
export {
  type CreateTtsAppFromBindingsOptions,
  type CreateTtsAppFromBindingsResult,
  createTtsAppFromBindings,
  TtsSecretName,
} from './tts-from-bindings';
export {
  type CreateTtsAppOptions,
  createTtsApp,
  type TtsRequireAuth,
} from './tts-routes';
