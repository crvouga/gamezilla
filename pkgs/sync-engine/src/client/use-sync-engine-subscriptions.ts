import { useEffect, useMemo, useState } from 'react';

import { useSyncEngine } from './sync-engine-context';
import type { SyncEngine } from './sync-engine-port';
import type { QuerySubscription } from './subscription-runtime';

export type SyncEngineQuerySubscriptionSpec = {
  readonly name: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly pollMs?: number;
};

export type SyncEngineSubscriptionsState = {
  /** True after every active subscription has reached its first checkpoint. */
  readonly ready: boolean;
};

function subscriptionsKey(
  specs: readonly SyncEngineQuerySubscriptionSpec[]
): string {
  return JSON.stringify(
    specs.map((s) => ({
      name: s.name,
      params: s.params,
      pollMs: s.pollMs,
    }))
  );
}

async function waitForSubscriptionReady(
  sub: QuerySubscription,
  abort: AbortSignal
): Promise<void> {
  if (abort.aborted) return;
  await sub.waitForFirstSync();
}

export type SubscribeAllArgs = {
  readonly subscribe: SyncEngine['subscribeQuery'];
  readonly specs: readonly SyncEngineQuerySubscriptionSpec[];
  readonly isCancelled: () => boolean;
  readonly liveUnsubs: Array<() => void>;
  readonly abort: AbortSignal;
};

async function subscribeOne(
  subscribe: SyncEngine['subscribeQuery'],
  spec: SyncEngineQuerySubscriptionSpec
): Promise<QuerySubscription> {
  return subscribe(
    spec.name,
    spec.params,
    spec.pollMs === undefined ? undefined : { pollMs: spec.pollMs }
  );
}

/**
 * Subscribe every stream first (so the sync client can download them together),
 * then wait for each first-sync. Unsubs are registered into `liveUnsubs` as soon
 * as each subscribe resolves so React effect cleanup can tear them down even
 * while a wait is in flight.
 */
export async function subscribeAll(args: SubscribeAllArgs): Promise<{
  readonly ready: boolean;
}> {
  const { subscribe, specs, isCancelled, liveUnsubs, abort } = args;
  const subs: QuerySubscription[] = [];
  for (const spec of specs) {
    if (isCancelled() || abort.aborted) break;
    const sub = await subscribeOne(subscribe, spec);
    if (isCancelled() || abort.aborted) {
      sub.unsubscribe();
      break;
    }
    liveUnsubs.push(() => sub.unsubscribe());
    subs.push(sub);
  }
  if (isCancelled() || abort.aborted) {
    return { ready: false };
  }
  await Promise.all(
    subs.map(async (sub) => {
      await waitForSubscriptionReady(sub, abort);
    })
  );
  return { ready: !isCancelled() && !abort.aborted };
}

/**
 * Subscribes to the given parameterized sync streams for the lifetime of the
 * caller. Re-subscribes when the specs list changes (by value).
 */
export function useSyncEngineSubscriptions(
  specs: readonly SyncEngineQuerySubscriptionSpec[]
): SyncEngineSubscriptionsState {
  const engine = useSyncEngine();
  const key = useMemo(() => subscriptionsKey(specs), [specs]);
  const [ready, setReady] = useState(specs.length === 0);

  useEffect(() => {
    const subscribe = engine.subscribeQuery;
    if (specs.length === 0) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const liveUnsubs: Array<() => void> = [];
    const abort = new AbortController();
    setReady(false);
    void (async () => {
      const next = await subscribeAll({
        subscribe,
        specs,
        isCancelled: () => cancelled,
        liveUnsubs,
        abort: abort.signal,
      });
      if (cancelled || abort.signal.aborted) return;
      if (next.ready) setReady(true);
    })().catch(() => {
      // Subscribe failures leave ready=false; cleanup aborts in-flight waits.
    });
    return () => {
      cancelled = true;
      abort.abort();
      for (const unsub of liveUnsubs) unsub();
    };
    // key encodes specs by value; engine identity drives reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key replaces specs
  }, [engine, key]);

  return { ready };
}
