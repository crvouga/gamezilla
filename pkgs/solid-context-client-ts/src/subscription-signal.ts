import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js';

export type ExternalSubscription<T> = {
  readonly getSnapshot: () => T;
  readonly subscribe: (listener: () => void) => () => void;
};

/**
 * Bridge an external `getSnapshot` / `subscribe` store into a Solid signal.
 * Unsubscribes when the owning reactive scope is disposed.
 */
export function createSubscriptionSignal<T>(
  source: ExternalSubscription<T>
): Accessor<T> {
  const [changes, setChanges] = createSignal(0);
  const unsubscribe = source.subscribe(() => {
    setChanges((count) => count + 1);
  });
  onCleanup(unsubscribe);
  return createMemo(() => {
    changes();
    return source.getSnapshot();
  });
}
