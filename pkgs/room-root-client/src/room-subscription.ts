import { batch } from 'solid-js';

type Source = {
  readonly subscribe: (listener: () => void) => () => void;
};
type Subscription = {
  readonly listeners: Set<() => void>;
  readonly unsubscribe: () => void;
};

const subscriptions = new WeakMap<Source, Subscription>();

/** One source notification is one Solid update, including across component owners. */
export function subscribeRoom(
  source: Source,
  listener: () => void
): () => void {
  let subscription = subscriptions.get(source);
  if (subscription === undefined) {
    const listeners = new Set([listener]);
    const unsubscribe = source.subscribe(() => {
      batch(() => {
        for (const notify of [...listeners]) {
          if (listeners.has(notify)) notify();
        }
      });
    });
    subscription = { listeners, unsubscribe };
    subscriptions.set(source, subscription);
  } else {
    subscription.listeners.add(listener);
  }
  const active = subscription;
  return () => {
    active.listeners.delete(listener);
    if (active.listeners.size > 0) return;
    if (subscriptions.get(source) !== active) return;
    subscriptions.delete(source);
    active.unsubscribe();
  };
}
