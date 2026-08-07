import type {
  SubscribeQueriesHandle,
  SyncEngineQuerySubscriptionSpec,
} from './subscribe-queries-types';
import type { QuerySubscription } from './subscription-runtime';

export type {
  SubscribeQueriesHandle,
  SyncEngineQuerySubscriptionSpec,
} from './subscribe-queries-types';

type SubscribeQueryFn = (
  queryName: string,
  parameters: Readonly<Record<string, unknown>>
) => QuerySubscription;

type SubscribeAllArgs = {
  readonly subscribe: SubscribeQueryFn;
  readonly specs: readonly SyncEngineQuerySubscriptionSpec[];
  readonly isCancelled: () => boolean;
  readonly liveUnsubs: Array<() => void>;
  readonly abort: AbortSignal;
};

async function waitForSubscriptionReady(
  sub: QuerySubscription,
  abort: AbortSignal
): Promise<void> {
  if (abort.aborted) return;
  await sub.waitForFirstSync();
}

/**
 * Subscribe every stream first (so the sync client can download them together),
 * then wait for each first-sync. Unsubs are registered into `liveUnsubs` as soon
 * as each subscribe resolves so cleanup can tear them down even while a wait
 * is in flight.
 */
async function subscribeAll(args: SubscribeAllArgs): Promise<{
  readonly ready: boolean;
}> {
  const { subscribe, specs, isCancelled, liveUnsubs, abort } = args;
  const subs: QuerySubscription[] = [];
  for (const spec of specs) {
    if (isCancelled() || abort.aborted) break;
    const sub = subscribe(spec.name, spec.params);
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

/** Effect-friendly multi-query subscribe for a sync engine. */
export function createSubscribeQueries(
  subscribeQuery: SubscribeQueryFn
): (
  specs: readonly SyncEngineQuerySubscriptionSpec[]
) => SubscribeQueriesHandle {
  return (specs) => {
    if (specs.length === 0) {
      return {
        ready: Promise.resolve(true),
        unsubscribe: () => undefined,
      };
    }
    let cancelled = false;
    const liveUnsubs: Array<() => void> = [];
    const abort = new AbortController();
    const ready = subscribeAll({
      subscribe: subscribeQuery,
      specs,
      isCancelled: () => cancelled,
      liveUnsubs,
      abort: abort.signal,
    }).then((next) => next.ready);
    return {
      ready,
      unsubscribe: () => {
        cancelled = true;
        abort.abort();
        for (const unsub of liveUnsubs) unsub();
      },
    };
  };
}
