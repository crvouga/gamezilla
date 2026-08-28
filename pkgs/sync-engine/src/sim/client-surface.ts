import type {
  SimClientHandle,
  SimRejection,
  SimSubscription,
} from './client-handle';
import type { SimHttpClient } from './http-bridge';
import type { SimPollablePromise } from './until';

function createOutcomePromise(
  engine: SimClientHandle['engine'],
  mutationId: string
): SimPollablePromise<'confirmed' | 'rejected'> {
  let settled = false;
  let resolve!: (v: 'confirmed' | 'rejected') => void;
  const promise = new Promise<'confirmed' | 'rejected'>((res) => {
    resolve = res;
  }) as SimPollablePromise<'confirmed' | 'rejected'>;

  const settle = (status: 'confirmed' | 'rejected') => {
    if (settled) return;
    settled = true;
    resolve(status);
  };

  const poll = async (): Promise<boolean> => {
    if (settled) return true;
    const status = await engine.mutationOutcome(mutationId);
    if (status === 'pending') return false;
    settle(status);
    return true;
  };

  Object.defineProperty(promise, '__simPoll', {
    value: poll,
    enumerable: false,
  });

  // Eager resolve when already terminal (safe to await without until).
  void engine.mutationOutcome(mutationId).then((status) => {
    if (status !== 'pending') settle(status);
  });

  return promise;
}

type ClientCore = Omit<
  SimClientHandle,
  | 'online'
  | 'foreground'
  | 'connect'
  | 'disconnect'
  | 'clearLocalData'
  | 'subscribe'
  | 'outcome'
  | 'rejections'
  | 'connection'
  | 'lastError'
  | 'hasSynced'
  | 'getSyncEngine'
  | 'nudge'
  | 'postMutations'
>;

/** Add flattened scenario-facing methods onto a built client handle. */
export function decorateClientSurface(handle: ClientCore): SimClientHandle {
  const subscribe = (
    name: string,
    params: Readonly<Record<string, unknown>>
  ): SimSubscription => {
    const sub = handle.engine.subscribeQuery(name, params);
    return {
      ready: sub.waitForFirstSync(),
      [Symbol.dispose]() {
        sub.unsubscribe();
      },
    };
  };

  return {
    ...handle,
    online: (v) => {
      handle.lifecycle.setOnline(v);
    },
    foreground: (v) => {
      handle.lifecycle.setForeground(v);
    },
    connect: () => handle.engine.connect(),
    disconnect: async () => {
      // In-flight query sweeps await sim HTTP, which only completes when the
      // scheduler runs. Abort so stopAndDrain cannot deadlock on disconnect.
      handle.http.abortPending();
      await handle.engine.disconnect();
    },
    clearLocalData: (reason) =>
      handle.engine.clearLocalData({
        reason: reason === 'revoked' ? 'revoked' : 'cache',
      }),
    subscribe,
    outcome: (mutationId) => createOutcomePromise(handle.engine, mutationId),
    rejections: () =>
      handle.engine.listRejections() as Promise<readonly SimRejection[]>,
    connection: () => handle.engine.status.getSnapshot().connection,
    lastError: () => handle.engine.status.getSnapshot().lastError,
    hasSynced: () => handle.engine.status.getSnapshot().hasSynced,
    getSyncEngine: () => handle.engine,
    nudge: async () => {
      handle.engine.wakeUploads();
      await handle.engine.refreshQueries();
    },
    postMutations: (rows: Parameters<SimHttpClient['postMutations']>[0]) =>
      handle.http.postMutations(rows),
  };
}
