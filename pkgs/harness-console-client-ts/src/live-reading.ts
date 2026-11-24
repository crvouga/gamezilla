import { type Accessor, createMemo, createSignal, onCleanup } from 'solid-js';

/** Something read again whenever it says it changed. */
export type LiveSource<T> = {
  readonly read: () => T;
  readonly subscribe: (listener: () => void) => () => void;
};

/**
 * `source().read()` as a tracked value, read again on every notification.
 * Another source releases the subscription to the one before it.
 */
export function createLiveReading<T>(
  source: Accessor<LiveSource<T>>
): Accessor<T> {
  const reading = createMemo<Accessor<T>>(() => {
    const current = source();
    const [changes, setChanges] = createSignal(0);
    onCleanup(current.subscribe(() => setChanges((count) => count + 1)));
    return () => {
      changes();
      return current.read();
    };
  });
  return createMemo(() => reading()());
}

/** A subscription that also notifies every `everyMs`, for sources that change unannounced. */
export function subscribeWithPolling(
  subscribe: (listener: () => void) => () => void,
  timers: {
    readonly setInterval: (fn: () => void, ms: number) => unknown;
    readonly clearInterval: (handle: unknown) => void;
  },
  everyMs: number
): (listener: () => void) => () => void {
  return (listener) => {
    const unsubscribe = subscribe(listener);
    const handle = timers.setInterval(listener, everyMs);
    return () => {
      unsubscribe();
      timers.clearInterval(handle);
    };
  };
}
