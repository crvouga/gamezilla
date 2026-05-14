/**
 * @gamezilla/assistant — public facade. Import only `@gamezilla/assistant/shared`
 * or `@gamezilla/assistant/client`. Implementation lives under `_internal/`.
 */
export { createAssistant } from './_internal/engine';
export type { Assistant, AssistantConfig } from './_internal/engine';

export type { AssistantSignal } from './_internal/signals';
export { defineSignal } from './_internal/signals';

export type { AssistantAction } from './_internal/action';

export type { Intent } from './_internal/intents';
export { INTENT } from './_internal/intents';

export type { GameAdapter, PlayerView } from './_internal/adapter';
export type { AssistantCandidate } from './_internal/candidates';
export { defineCandidate } from './_internal/candidates';

export type { AssistantRenderer } from './_internal/renderer';
export type { AssistantClock } from './_internal/clock';

export type { AssistantSnapshot } from './_internal/snapshot';
