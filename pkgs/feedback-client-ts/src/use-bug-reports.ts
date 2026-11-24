import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js';
import type { BugReportController, BugReportState } from './controller';
import type { ShakeControl, ShakeState } from './shake';

type Source<T> = {
  state(): T;
  subscribe(listener: () => void): () => void;
};

export function useSource<T>(source: Accessor<Source<T>>): Accessor<T> {
  // One subscription per source: another source drops the one before it.
  const reading = createMemo<Accessor<T>>(() => {
    const current = source();
    const [changes, setChanges] = createSignal(0);
    onCleanup(current.subscribe(() => setChanges((count) => count + 1)));
    return () => {
      changes();
      return current.state();
    };
  });
  return () => reading()();
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
