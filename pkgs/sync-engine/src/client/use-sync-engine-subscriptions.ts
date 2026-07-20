import { useEffect, useMemo, useState } from 'react';

import type { SyncEngine } from './sync-engine-port';
import { useSyncEngine } from './sync-engine-context';
import type { SyncStreamSubscription } from './sync-stream-subscription';

export type SyncEngineStreamSubscriptionSpec = {
  readonly stream: string;
  readonly params: Readonly<Record<string, string | number>>;
  /** Lower is higher priority (PowerSync: 0–3). Omit to use the stream default. */
  readonly priority?: number;
};

export type SyncEngineSubscriptionsState = {
  /** True after every active subscription has reached its first checkpoint. */
  readonly ready: boolean;
};

function subscriptionsKey(
  specs: readonly SyncEngineStreamSubscriptionSpec[]
): string {
  return JSON.stringify(
    specs.map((s) => ({
      stream: s.stream,
      params: s.params,
      priority: s.priority,
    }))
  );
}

async function waitForSubscriptionReady(
  sub: SyncStreamSubscription,
  abort: AbortSignal
): Promise<void> {
  if (sub.waitForFirstSync === undefined) return;
  await sub.waitForFirstSync(abort);
}

export type SubscribeAllArgs = {
  readonly subscribe: NonNullable<SyncEngine['subscribeSyncStream']>;
  readonly specs: readonly SyncEngineStreamSubscriptionSpec[];
  readonly isCancelled: () => boolean;
  readonly liveUnsubs: Array<() => void>;
  readonly abort: AbortSignal;
};

async function subscribeOne(
  subscribe: NonNullable<SyncEngine['subscribeSyncStream']>,
  spec: SyncEngineStreamSubscriptionSpec
): Promise<SyncStreamSubscription> {
  return subscribe(
    spec.stream,
    spec.params,
    spec.priority === undefined ? undefined : { priority: spec.priority }
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
  const subs: SyncStreamSubscription[] = [];
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
 * caller. No-ops (ready immediately) when the engine does not support stream
 * subscriptions. Re-subscribes when the specs list changes (by value).
 */
export function useSyncEngineSubscriptions(
  specs: readonly SyncEngineStreamSubscriptionSpec[]
): SyncEngineSubscriptionsState {
  const engine = useSyncEngine();
  const key = useMemo(() => subscriptionsKey(specs), [specs]);
  const [ready, setReady] = useState(specs.length === 0);

  useEffect(() => {
    const subscribe = engine.subscribeSyncStream;
    if (subscribe === undefined || specs.length === 0) {
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
