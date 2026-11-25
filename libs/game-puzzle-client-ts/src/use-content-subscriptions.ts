import type { SyncEngineQuerySubscriptionSpec } from '@pkgs/sync-engine-client-ts/subscribe-queries-types';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';

export function useContentSubscriptions(
  readRequests: Accessor<readonly SyncEngineQuerySubscriptionSpec[]>
): Accessor<boolean> {
  const engine = useSyncEngineInstance();
  const requests = createMemo(readRequests, {
    equals: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  });
  // Other requests are not ready until their own subscription says so.
  const [ready, setReady] = createSignal((): boolean => {
    requests();
    return false;
  });
  createEffect(requests, (specs) => {
    const subscription = engine.subscribeQueries(specs);
    let live = true;
    void subscription.ready.then((value) => {
      if (live) setReady(value);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  });
  return ready;
}
