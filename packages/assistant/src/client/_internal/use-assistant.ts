import { useEffect, useRef, useState } from 'react';
import type { AssistantAction } from '../../shared/_internal/action';
import type { Assistant } from '../../shared/_internal/engine';
import type { AssistantSignal } from '../../shared/_internal/signals';

/**
 * Re-runs `observe` when `watch` changes (e.g. `${status}:${solveIdx}`).
 * `buildSignal` should close over the latest game fields via refs.
 */
export function useAssistant<TPayload>(args: {
  readonly assistant: Assistant<TPayload>;
  readonly buildSignal: () => AssistantSignal<TPayload> | null;
  readonly watch: string;
}): AssistantAction | null {
  const [action, setAction] = useState<AssistantAction | null>(null);
  const assistantRef = useRef(args.assistant);
  assistantRef.current = args.assistant;

  const buildSignalRef = useRef(args.buildSignal);
  buildSignalRef.current = args.buildSignal;

  useEffect(() => {
    const s = buildSignalRef.current();
    if (s === null) {
      setAction(null);
      return;
    }
    setAction(assistantRef.current.observe(s));
  }, [args.assistant, args.watch, args.buildSignal]);

  return action;
}
