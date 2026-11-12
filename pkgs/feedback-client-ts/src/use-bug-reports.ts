import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import type { BugReportController, BugReportState } from './controller';
import type { ShakeControl, ShakeState } from './shake';

type Source<T> = {
  state(): T;
  subscribe(listener: () => void): () => void;
};

function useSource<T>(source: Accessor<Source<T>>): Accessor<T> {
  const [state, setState] = createSignal<{ value: T }>();
  createEffect(() => {
    const current = source();
    setState({ value: current.state() });
    onCleanup(current.subscribe(() => setState({ value: current.state() })));
  });
  return () => (state() ?? { value: source().state() }).value;
}

export function useBugReportState(
  controller: Accessor<BugReportController>
): Accessor<BugReportState> {
  return useSource(controller);
}

export function useShakeState(
  shake: Accessor<ShakeControl>
): Accessor<ShakeState> {
  return useSource(shake);
}
