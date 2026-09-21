import type {
  SyncApiFetch,
  SyncClientAuth,
} from '@libs/client-app/sync/sync-api';
import { useTimers } from '@pkgs/clock/solid';
import { useLogger } from '@pkgs/logger/solid';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';
import { useAppData } from '../app-features-context';
import { useLocalPaintLatch } from '../boot/local-paint-latch';
import { useClientEnv, useSyncEnginePool } from '../client-env-context';
import { exposeLocalSqlForE2e } from '../e2e-local-sql';
import { useLocalIdentity } from '../identity/identity-context';
import { originAvailabilityFor } from '../origin-availability-for-env';
import { BOOT_STUCK_MESSAGE } from './boot-error-screen';
import {
  createSyncEngineBootState,
  type ReadySyncEngine,
} from './create-sync-engine-boot-state';

/**
 * UI watchdog: shorter than the SQLite open timeout so users see Reload
 * before the lower layer's open timeout alone would surface.
 */
const BOOT_STUCK_MS = 15_000;

/**
 * Open SQLite once fonts have released the paint latch. No extra delay: with
 * the shell entry kept free of mutation/WASM graphs, first paint settles
 * before worker fetches without waiting here (sims + LHCI).
 */
function useMayOpenDbAfterPaint(): Accessor<boolean> {
  const latch = useLocalPaintLatch();
  return () => latch.bootReady();
}

function useSyncBootPromise(args: {
  readonly userId: Accessor<string>;
  readonly mayOpenDb: Accessor<boolean>;
  readonly preloadReadyTree: () => Promise<unknown>;
}): Accessor<Promise<ReadySyncEngine>> {
  const env = useClientEnv();
  const loadApp = useAppData();
  const pool = useSyncEnginePool();
  const identity = useLocalIdentity();
  const observability = useObservability();
  const fetchFn: SyncApiFetch = instrumentFetch(observability, env.server);
  const availability = originAvailabilityFor(env);
  const auth: SyncClientAuth = {
    getAccountId: () => identity.userId(),
    getDeviceId: () => identity.deviceId(),
    getSessionToken: () => identity.sessionToken(),
  };
  const databaseName = createMemo(() =>
    env.resolveDatabaseName({ userId: args.userId() })
  );

  return createMemo<Promise<ReadySyncEngine>>(() => {
    if (!args.mayOpenDb()) {
      return new Promise<ReadySyncEngine>(() => {
        /* pending until post-paint unlock */
      });
    }
    const engine = pool.getOrCreate({
      loadApp,
      openSqlClient: (openArgs) => env.openSqlClient(openArgs),
      createPubSub: () => env.createPubSub(),
      config: { getApiUrl: () => env.serverUrl },
      fetchFn,
      auth,
      clock: env.clock,
      timers: env.timers,
      createId: env.createId,
      random: env.random,
      getFreshAuthToken: () => Promise.resolve(identity.sessionToken()),
      databaseName: databaseName(),
      userId: args.userId(),
      ...(availability.kind === 'health'
        ? {
            waitUntilAvailable: (signal?: AbortSignal | null) =>
              availability.waitUntilAvailable(signal),
          }
        : {}),
    });
    return Promise.all([
      engine,
      pool.mutationRegistry(),
      args.preloadReadyTree(),
    ]).then(async ([resolved, registry]) => {
      await resolved.connect();
      exposeLocalSqlForE2e(resolved.db);
      return { engine: resolved, registry };
    });
  });
}

export type SyncEngineBootViews = {
  readonly bootError: Accessor<Error | null>;
  readonly ready: Accessor<ReadySyncEngine | null>;
  readonly stuckError: Accessor<Error | null>;
};

/**
 * Identity-scoped sync engine boot + stuck watchdog. Callers render loading /
 * error / ready from the accessors (never a blank shell on hang).
 */
export function useSyncEngineBootViews(args: {
  readonly userId: Accessor<string>;
  readonly preloadReadyTree: () => Promise<unknown>;
}): SyncEngineBootViews {
  const timers = useTimers();
  const log = useLogger('sync-engine-boot');
  const latch = useLocalPaintLatch();
  const mayOpenDb = useMayOpenDbAfterPaint();
  const bootPromise = useSyncBootPromise({
    userId: args.userId,
    mayOpenDb,
    preloadReadyTree: args.preloadReadyTree,
  });

  const boot = createSyncEngineBootState({
    boot: bootPromise,
    warm: () => null,
    onError: (error) =>
      log.error('local database boot failed', { error: error.message }),
  });

  const [stuck, setStuck] = createSignal(false);
  createEffect(() => {
    if (boot().phase !== 'loading') {
      setStuck(false);
      return;
    }
    setStuck(false);
    const id = timers.setTimeout(() => setStuck(true), BOOT_STUCK_MS);
    onCleanup(() => timers.clearTimeout(id));
  });

  createEffect(() => {
    if (boot().phase !== 'loading' || stuck()) latch.markEngineReady();
  });

  return {
    bootError: () => {
      const state = boot();
      return state.phase === 'error' ? state.error : null;
    },
    ready: () => {
      const state = boot();
      return state.phase === 'ready' ? state.ready : null;
    },
    stuckError: () =>
      stuck() && boot().phase === 'loading'
        ? new Error(BOOT_STUCK_MESSAGE)
        : null,
  };
}
