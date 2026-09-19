import { type Accessor, createEffect, createSignal, on } from 'solid-js';
import type { AssistantAction } from '../../shared/internal/action';
import type { Assistant } from '../../shared/internal/engine';
import type { AssistantSignal } from '../../shared/internal/signals';

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
