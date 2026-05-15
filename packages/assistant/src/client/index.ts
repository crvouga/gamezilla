export { emitAssistantSpeakingMessage } from './_internal/assistant-speaking-bridge';
export { useAssistant } from './_internal/use-assistant';
export { createNoopRenderer } from './_internal/noop-renderer';
export { createSystemClock } from './_internal/system-clock';
export {
  SpeakingAvatarAssistant,
  type SpeakingAvatarAssistantProps,
} from './_internal/speaking-avatar-assistant';
export {
  AssistantSpeechResolverProvider,
  useAssistantSpeechResolver,
} from './speech-resolver-context';
export { createAssistantSpeechRenderer } from './create-speech-renderer';
