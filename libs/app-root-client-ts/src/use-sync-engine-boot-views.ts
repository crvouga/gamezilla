import { exposeLocalSqlForTests } from '@libs/app-root-shared-ts/test-local-sql';
import { useGetFreshAuthToken } from '@libs/auth-client-ts/use-fresh-auth-token';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import type { SyncClientAuth } from '@pkgs/sync-engine-client-ts/sync-http-client';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from 'solid-js';
import { useAppData } from './app-subs-context';
import { BOOT_STUCK_MESSAGE } from './boot-error-screen';
import { traceBrowserStartup } from './browser-boundaries';
import { useClientEnv, useSyncEnginePool } from './client-env-context';
import type { ReadySyncEngine } from './create-sync-engine-boot-state';
import { createSyncEngineBootState } from './create-sync-engine-boot-state';
import { useLocalIdentity } from './identity-context';
import { originAvailabilityFor } from './origin-availability-for-env';
import type { SyncApiFetch } from './sync-api';

/**
 * UI watchdog for a boot that never finishes. A slow or broken local
 * database cannot trip it: the open deadline and the per-call deadline
 * (`open-main-sql-client`) move the app to a disposable database long before
 * this, so it is only for what is not SQLite (a module that never loads).
 */
const BOOT_STUCK_MS = 30_000;

/** Opens SQLite as soon as an identity is bound: nothing else gates it. */
function useSyncBootPromise(args: {
  readonly userId: Accessor<string>;
}): Accessor<Promise<ReadySyncEngine>> {
  const env = useClientEnv();
  const loadApp = useAppData();
  const pool = useSyncEnginePool();
  const identity = useLocalIdentity();
  const getFreshAuthToken = useGetFreshAuthToken();
  const log = useLogger('sync-engine-boot');
  const fetchFn: SyncApiFetch = env.server;
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
    const engine = pool.getOrCreate({
      loadApp,
      openSqlClient: (openArgs) => env.openSqlClient(openArgs),
      ...(env.localCallDeadlineMs !== undefined
        ? { localCallDeadlineMs: env.localCallDeadlineMs }
        : {}),
      ...(env.reconcileIntervalMs !== undefined
        ? { reconcileIntervalMs: env.reconcileIntervalMs }
        : {}),
      createPubSub: env.createPubSub,
      ...(env.canSubscribe !== undefined
        ? { canSubscribe: env.canSubscribe }
        : {}),
      config: { getApiUrl: () => env.serverUrl },
      fetchFn,
      auth,
      clock: env.clock,
      timers: env.timers,
      createId: env.createId,
      random: env.random,
      moderation: env.moderation,
      getFreshAuthToken,
      databaseName: databaseName(),
      userId: args.userId(),
      ...(availability.kind === 'health'
        ? {
            waitUntilAvailable: (signal?: AbortSignal | null) =>
              availability.waitUntilAvailable(signal),
          }
        : {}),
    });
    return Promise.all([engine, pool.mutationRegistry(), loadApp()]).then(
      ([resolved, registry, app]) => {
        // Connecting starts background sync. Whatever goes wrong there shows
        // in the engine's status; it never keeps the app from opening.
        void traceBrowserStartup('client.sync.connect', () =>
          resolved.connect()
        ).catch((error: unknown) =>
          log.error('sync engine connect failed', {
            error: error instanceof Error ? error.message : String(error),
          })
        );
        exposeLocalSqlForTests(resolved.db);
        return { engine: resolved, registry, turnGames: app.turnGames };
      }
    );
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
}): SyncEngineBootViews {
  const timers = useTimers();
  const log = useLogger('sync-engine-boot');
  const bootPromise = useSyncBootPromise({ userId: args.userId });

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
