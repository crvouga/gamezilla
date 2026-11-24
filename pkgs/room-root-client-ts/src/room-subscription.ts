type Source = {
  readonly subscribe: (listener: () => void) => () => void;
};
type Subscription = {
  readonly listeners: Set<() => void>;
  readonly unsubscribe: () => void;
};

const subscriptions = new WeakMap<Source, Subscription>();

/** Every reader of a source shares one subscription, so one notification is one Solid update. */
export function subscribeRoom(
  source: Source,
  listener: () => void
): () => void {
  let subscription = subscriptions.get(source);
  if (subscription === undefined) {
    const listeners = new Set([listener]);
    const unsubscribe = source.subscribe(() => {
      for (const notify of [...listeners]) {
        if (listeners.has(notify)) notify();
      }
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
