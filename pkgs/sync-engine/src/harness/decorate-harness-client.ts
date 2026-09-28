import type {
  HarnessClient,
  HarnessRejection,
  HarnessSubscription,
} from './client';
import type { HarnessHttpClient } from './http-bridge';

/** Promise brand used by sync client.outcome() — polled by {@link waitUntil}. */
export type HarnessPollablePromise<T> = Promise<T> & {
  readonly __harnessPoll: () => Promise<boolean>;
};

function createOutcomePromise(
  engine: HarnessClient['engine'],
  mutationId: string
): HarnessPollablePromise<'confirmed' | 'rejected'> {
  let settled = false;
  let resolve!: (v: 'confirmed' | 'rejected') => void;
  const promise = new Promise<'confirmed' | 'rejected'>((res) => {
    resolve = res;
  }) as HarnessPollablePromise<'confirmed' | 'rejected'>;

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

  Object.defineProperty(promise, '__harnessPoll', {
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
  HarnessClient,
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

/** In-flight harness HTTP only completes when the scheduler runs — abort first. */
async function abortHttpThen(
  handle: ClientCore,
  op: () => Promise<void>
): Promise<void> {
  handle.http.abortPending();
  await op();
}

/** Add flattened scenario-facing methods onto a built client handle. */
export function decorateHarnessClient(handle: ClientCore): HarnessClient {
  const subscribe = (
    name: string,
    params: Readonly<Record<string, unknown>>
  ): HarnessSubscription => {
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
    disconnect: () => abortHttpThen(handle, () => handle.engine.disconnect()),
    clearLocalData: (reason) =>
      abortHttpThen(handle, () =>
        handle.engine.clearLocalData({
          reason: reason === 'revoked' ? 'revoked' : 'cache',
        })
      ),
    subscribe,
    outcome: (mutationId) => createOutcomePromise(handle.engine, mutationId),
    rejections: () =>
      handle.engine.listRejections() as Promise<readonly HarnessRejection[]>,
    connection: () => handle.engine.status.getSnapshot().connection,
    lastError: () => handle.engine.status.getSnapshot().lastError,
    hasSynced: () => handle.engine.status.getSnapshot().hasSynced,
    getSyncEngine: () => handle.engine,
    nudge: async () => {
      handle.engine.wakeUploads();
      await handle.engine.refreshQueries();
    },
    postMutations: (rows: Parameters<HarnessHttpClient['postMutations']>[0]) =>
      handle.http.postMutations(rows),
  };
}
