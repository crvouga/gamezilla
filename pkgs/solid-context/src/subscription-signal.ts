import { type Accessor, createSignal, onCleanup } from 'solid-js';

export type ExternalSubscription<T> = {
  readonly getSnapshot: () => T;
  readonly subscribe: (listener: () => void) => () => void;
};

/**
 * Bridge an external `getSnapshot` / `subscribe` store into a Solid signal
 * (the Solid counterpart of `useSyncExternalStore`). Unsubscribes when
 * the owning reactive scope is disposed.
 */
export function createSubscriptionSignal<T>(
  source: ExternalSubscription<T>
): Accessor<T> {
  const [value, setValue] = createSignal<T>(source.getSnapshot());
  const unsubscribe = source.subscribe(() => {
    setValue(() => source.getSnapshot());
  });
  onCleanup(unsubscribe);
  return value;
}
