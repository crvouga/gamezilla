/**
 * Server-side facade for `@gamezilla/tts`. Hosts that just want to mount the
 * pre-wired ElevenLabs+R2 setup should import from here.
 */
export {
  createTtsAppFromBindings,
  TtsDopplerKey,
  type CreateTtsAppFromBindingsOptions,
} from './tts-from-bindings';
export {
  createTtsApp,
  type CreateTtsAppOptions,
  type TtsRequireAuth,
} from './tts-routes';
export {
  TtsProviderError,
  isTtsProviderError,
  type TtsProvider,
  type TtsSynthesizeInput,
  type TtsSynthesizeOutput,
} from './ports/tts-provider';
export { ElevenLabsTtsProvider } from './adapters/elevenlabs-tts-provider';
export { InMemoryTtsProvider } from './adapters/in-memory-tts-provider';
