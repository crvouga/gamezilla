import { useEffect, useMemo } from 'react';

import { useSyncEngine } from './sync-engine-context';
import type { SyncStreamSubscription } from './sync-stream-subscription';

export type SyncEngineStreamSubscriptionSpec = {
  readonly stream: string;
  readonly params: Readonly<Record<string, string | number>>;
};

function subscriptionsKey(
  specs: readonly SyncEngineStreamSubscriptionSpec[]
): string {
  return JSON.stringify(
    specs.map((s) => ({ stream: s.stream, params: s.params }))
  );
}

async function subscribeAll(
  subscribe: (
    streamName: string,
    parameters: Readonly<Record<string, string | number>>
  ) => Promise<SyncStreamSubscription>,
  specs: readonly SyncEngineStreamSubscriptionSpec[],
  isCancelled: () => boolean
): Promise<Array<() => void>> {
  const unsubs: Array<() => void> = [];
  for (const spec of specs) {
    if (isCancelled()) break;
    const sub = await subscribe(spec.stream, spec.params);
    if (isCancelled()) {
      sub.unsubscribe();
      break;
    }
    unsubs.push(() => sub.unsubscribe());
  }
  return unsubs;
}

/**
 * Subscribes to the given parameterized sync streams for the lifetime of the
 * caller. No-ops when the engine does not support stream subscriptions.
 * Re-subscribes when the specs list changes (by value).
 */
export function useSyncEngineSubscriptions(
  specs: readonly SyncEngineStreamSubscriptionSpec[]
): void {
  const engine = useSyncEngine();
  const key = useMemo(() => subscriptionsKey(specs), [specs]);

  useEffect(() => {
    const subscribe = engine.subscribeSyncStream;
    if (subscribe === undefined) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    void (async () => {
      const next = await subscribeAll(subscribe, specs, () => cancelled);
      if (cancelled) {
        for (const unsub of next) unsub();
        return;
      }
      for (const unsub of next) unsubs.push(unsub);
    })();
    return () => {
      cancelled = true;
      for (const unsub of unsubs) unsub();
    };
    // key encodes specs by value; engine identity drives reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key replaces specs
  }, [engine, key]);
}
