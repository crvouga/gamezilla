/**
 * Server-side facade for `@pkgs/tts`. Vendor wiring lives in the provider
 * package (`@pkgs/tts-elevenlabs`).
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
export { InMemoryTtsProvider } from './adapters/in-memory-tts-provider';
export {
  isTtsProviderError,
  type TtsProvider,
  TtsProviderError,
  type TtsSynthesizeInput,
  type TtsSynthesizeOutput,
} from './ports/tts-provider';
export {
  type CreateTtsAppOptions,
  createTtsApp,
  type TtsRequireAuth,
} from './tts-routes';
