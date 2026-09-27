export type { CreateAssistantDialogueTreeRendererDeps } from './create-dialogue-tree-renderer';
export { createAssistantDialogueTreeRenderer } from './create-dialogue-tree-renderer';
export {
  type AssistantSpeakingUpdate,
  emitAssistantSpeakingMessage,
  subscribeAssistantSpeaking,
} from './internal/assistant-speaking-bridge';
export { createNoopRenderer } from './internal/noop-renderer';
export {
  SpeakingAvatarAssistant,
  type SpeakingAvatarAssistantProps,
} from './internal/speaking-avatar-assistant';
export { createSystemClock } from './internal/system-clock';
export { useAssistant } from './internal/use-assistant';
