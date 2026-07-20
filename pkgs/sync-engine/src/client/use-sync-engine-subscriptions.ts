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
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c605ca'},body:JSON.stringify({sessionId:'c605ca',runId:'post-fix',hypothesisId:'H-H',location:'use-sync-engine-subscriptions.ts:subscribe-start',message:'subscribing to stream',data:{stream:spec.stream,params:spec.params,priority:spec.priority??null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const sub = await subscribe(
    spec.stream,
    spec.params,
    spec.priority === undefined ? undefined : { priority: spec.priority }
  );
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c605ca'},body:JSON.stringify({sessionId:'c605ca',runId:'post-fix',hypothesisId:'H-H',location:'use-sync-engine-subscriptions.ts:subscribed',message:'stream subscribe resolved',data:{stream:spec.stream,params:spec.params},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return sub;
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
    subs.map(async (sub, index) => {
      const spec = specs[index];
      await waitForSubscriptionReady(sub, abort);
      // #region agent log
      if (spec !== undefined) {
        fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c605ca'},body:JSON.stringify({sessionId:'c605ca',runId:'post-fix',hypothesisId:'H-H',location:'use-sync-engine-subscriptions.ts:first-sync',message:'stream first sync reached',data:{stream:spec.stream,params:spec.params,cancelled:isCancelled(),aborted:abort.aborted},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c605ca'},body:JSON.stringify({sessionId:'c605ca',runId:'post-fix',hypothesisId:'H-G',location:'use-sync-engine-subscriptions.ts:effect',message:'subscriptions effect',data:{subscribeSupported:subscribe!==undefined,specCount:specs.length,key},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    })().catch((error: unknown) => {
      // #region agent log
      fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c605ca'},body:JSON.stringify({sessionId:'c605ca',runId:'post-fix',hypothesisId:'H-H',location:'use-sync-engine-subscriptions.ts:error',message:'subscribeAll failed',data:{error:String(error),key},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
