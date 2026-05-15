import type { Intent } from './_internal/intents';

export type AssistantSpeechRequest = {
  readonly intent: Intent;
  readonly payloadRef: string;
  readonly tags: readonly string[];
  readonly locale: string;
  /** Structured metadata from the game (e.g. parsed payloadRef). */
  readonly meta: Readonly<Record<string, unknown>>;
};

export interface AssistantSpeechResolver {
  readonly id: string;
  resolve(
    request: AssistantSpeechRequest,
    signal: AbortSignal
  ): Promise<string | null>;
}
