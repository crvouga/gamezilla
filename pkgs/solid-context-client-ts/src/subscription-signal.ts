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
  // A version counter private to this bridge. The source decides when it
  // notifies, which may be while a component body or a computation runs.
  const [changes, setChanges] = createSignal(0, { ownedWrite: true });
  const unsubscribe = source.subscribe(() => {
    setChanges((count) => count + 1);
  });
  onCleanup(unsubscribe);
  return createMemo(() => {
    changes();
    return source.getSnapshot();
  });
}
