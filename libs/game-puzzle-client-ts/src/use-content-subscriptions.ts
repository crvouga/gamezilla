import type { SyncEngineQuerySubscriptionSpec } from '@pkgs/sync-engine-client-ts/subscribe-queries-types';
import { useSyncEngineInstance } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';

export function useContentSubscriptions(
  readRequests: Accessor<readonly SyncEngineQuerySubscriptionSpec[]>
): Accessor<boolean> {
  const engine = useSyncEngineInstance();
  const [ready, setReady] = createSignal(false);
  const requests = createMemo(readRequests, [], {
    equals: (left, right) => JSON.stringify(left) === JSON.stringify(right),
  });
  createEffect(() => {
    setReady(false);
    const subscription = engine.subscribeQueries(requests());
    let live = true;
    void subscription.ready.then((value) => {
      if (live) setReady(value);
    });
    onCleanup(() => {
      live = false;
      subscription.unsubscribe();
    });
  });
  return ready;
}
