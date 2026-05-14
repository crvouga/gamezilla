import type { Assistant } from '../../shared/index';

const sinks = new WeakMap<object, (message: string | null) => void>();

/**
 * Pushes the latest coach line to the {@link SpeakingAvatarAssistant} that
 * subscribed for this `assistant` instance (WeakMap keyed by identity).
 */
export function emitAssistantSpeakingMessage<TPayload>(
  assistant: Assistant<TPayload>,
  message: string | null
): void {
  sinks.get(assistant as object)?.(message);
}

export function subscribeAssistantSpeaking<TPayload>(
  assistant: Assistant<TPayload>,
  setMessage: (message: string | null) => void
): () => void {
  const key = assistant as object;
  sinks.set(key, setMessage);
  return () => {
    sinks.delete(key);
  };
}
