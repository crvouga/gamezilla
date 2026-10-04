import type { AssistantAction } from '@pkgs/assistant-shared/action';
import type { Assistant } from '@pkgs/assistant-shared/engine';
import type { AssistantSignal } from '@pkgs/assistant-shared/signals';
import { type Accessor, createEffect, createSignal, on } from 'solid-js';

/**
 * Re-runs `observe` when `watch` changes (e.g. `${status}:${solveIdx}`).
 * Pass live getters for `assistant` and `watch`; `buildSignal` reads current game state.
 */
export function useAssistant<TPayload>(args: {
  readonly assistant: Assistant<TPayload>;
  readonly buildSignal: () => AssistantSignal<TPayload> | null;
  readonly watch: string;
}): Accessor<AssistantAction | null> {
  const [action, setAction] = createSignal<AssistantAction | null>(null);
  createEffect(
    on(
      () => [args.assistant, args.watch, args.buildSignal] as const,
      ([assistant]) => {
        const signal = args.buildSignal();
        setAction(signal === null ? null : assistant.observe(signal));
      }
    )
  );

  return action;
}
