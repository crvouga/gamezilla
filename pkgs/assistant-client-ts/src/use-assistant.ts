import type { AssistantAction } from '@pkgs/assistant-shared-ts/action';
import type { Assistant } from '@pkgs/assistant-shared-ts/engine';
import type { AssistantSignal } from '@pkgs/assistant-shared-ts/signals';
import { type Accessor, createEffect, createSignal, untrack } from 'solid-js';

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
    () => [args.assistant, args.watch, args.buildSignal] as const,
    ([assistant, , buildSignal]) => {
      // Only `watch` decides when to observe: the game state behind the
      // signal is read as it stands at that instant.
      const signal = untrack(buildSignal);
      setAction(signal === null ? null : assistant.observe(signal));
    }
  );

  return action;
}
