export type AssistantSignal<TPayload = unknown> = {
  readonly __brand: 'AssistantSignal';
  readonly kind: string;
  readonly tags: readonly string[];
  readonly payload: TPayload;
};

export function defineSignal<TPayload>(args: {
  readonly kind: string;
  readonly tags?: readonly string[] | undefined;
  readonly payload: TPayload;
}): AssistantSignal<TPayload> {
  return {
    __brand: 'AssistantSignal',
    kind: args.kind,
    tags: args.tags ?? [],
    payload: args.payload,
  };
}

export function readAssistantSignal<TPayload>(
  signal: AssistantSignal<TPayload>
): {
  readonly kind: string;
  readonly tags: readonly string[];
  readonly payload: TPayload;
} {
  return {
    kind: signal.kind,
    tags: signal.tags,
    payload: signal.payload,
  };
}
