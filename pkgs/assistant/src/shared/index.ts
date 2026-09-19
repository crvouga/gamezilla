/**
 * @pkgs/assistant — public facade. Import only `@pkgs/assistant/shared`
 * or `@pkgs/assistant/client`. Implementation lives under `internal/`.
 */

export type {
  DialogueContext,
  DialogueLookupKey,
  DialogueNode,
  DialogueRng,
  DialogueStep,
  DialogueTree,
  DialogueTreeBucketSpec,
  DialogueTreeSpec,
  DialogueTreeThemeSpec,
} from './dialogue-tree';
export {
  defineDialogueTree,
  pickDialogueVariant,
  pickDialogueVariantIndex,
  substituteDialogueText,
} from './dialogue-tree';
export type { AssistantAction, AssistantSpeakAction } from './internal/action';
export type { GameAdapter, PlayerView } from './internal/adapter';
export type { AssistantCandidate } from './internal/candidates';
export { defineCandidate } from './internal/candidates';
export type { AssistantClock } from './internal/clock';
export type { Assistant, AssistantConfig } from './internal/engine';
export { createAssistant } from './internal/engine';
export type { Intent } from './internal/intents';
export { INTENT } from './internal/intents';
export type { AssistantRenderer } from './internal/renderer';
export type { AssistantSignal } from './internal/signals';
export { defineSignal } from './internal/signals';
export type { AssistantSnapshot } from './internal/snapshot';
