import type { Assistant } from '../../shared/index';

export type AssistantSpeakingUpdate = {
  readonly message: string | null;
  /** When true, bubble shows typing dots (LLM / coach line in flight). */
  readonly bubbleResolving?: boolean;
};

const sinks = new WeakMap<object, (u: AssistantSpeakingUpdate) => void>();

/**
 * Pushes the latest coach line to the {@link SpeakingAvatarAssistant} that
 * subscribed for this `assistant` instance (WeakMap keyed by identity).
 */
export function emitAssistantSpeakingMessage<TPayload>(
  assistant: Assistant<TPayload>,
  message: string | null,
  options?: { readonly bubbleResolving?: boolean }
): void {
  const sink = sinks.get(assistant as object);
  if (sink === undefined) {
    return;
  }
  if (options?.bubbleResolving === undefined) {
    sink({ message });
  } else {
    sink({ message, bubbleResolving: options.bubbleResolving });
  }
}

export function subscribeAssistantSpeaking<TPayload>(
  assistant: Assistant<TPayload>,
  onUpdate: (u: AssistantSpeakingUpdate) => void
): () => void {
  const key = assistant as object;
  sinks.set(key, onUpdate);
  return () => {
    sinks.delete(key);
  };
}
