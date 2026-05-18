export {
  emitAssistantSpeakingMessage,
  type AssistantSpeakingUpdate,
} from './_internal/assistant-speaking-bridge';
export { useAssistant } from './_internal/use-assistant';
export { createNoopRenderer } from './_internal/noop-renderer';
export { createSystemClock } from './_internal/system-clock';
export {
  SpeakingAvatarAssistant,
  type SpeakingAvatarAssistantProps,
} from './_internal/speaking-avatar-assistant';
export { createAssistantDialogueTreeRenderer } from './create-dialogue-tree-renderer';
export type { CreateAssistantDialogueTreeRendererDeps } from './create-dialogue-tree-renderer';
