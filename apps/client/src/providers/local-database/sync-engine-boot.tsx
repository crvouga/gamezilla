import {
  useClientEnv,
  useSyncEnginePool,
} from '@apps/client/product/client-env-provider';
import { SIM_SERVER_URL } from '@apps/server/system/migrate-sim-sqlite';
import { useConfigService } from '@libs/auth/public/config-service-context';
import { useCurrentAccountId } from '@libs/auth/public/use-current-account-id';
import { useDeviceId } from '@libs/auth/public/use-device-id';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth/public/use-fresh-auth-token';
import { useOptionalOriginAvailability } from '@pkgs/http-client';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { SqlClientProvider } from '@pkgs/sql-client/react-context';
import {
  type SyncEngine,
  SyncEnginePaintGateContext,
  SyncEngineProvider,
} from '@pkgs/sync-engine/client';
import { type ReactNode, useMemo, useRef } from 'react';
import type { SyncApiFetch, SyncClientAuth } from '../../sync/sync-api';
import type { AppSyncEnginePool } from '../../sync/sync-engine-pool';
import { useEmbeddedApp } from '../embedded-app-context';
import { AppObservabilityFromClientConfig } from './app-observability-from-client-config';
import {
  LocalDatabaseBootErrorScreen,
  LocalDatabaseBootLoadingScreen,
} from './boot-screens';
import { SyncEmqxPushFromClientConfig } from './sync-emqx-push-from-client-config';
import { useSyncEngineBootState } from './use-sync-engine-boot-state';

function useIdentitySqliteDbName(userId: string): string {
  const env = useClientEnv();
  return useMemo(() => env.resolveDatabaseName({ userId }), [userId, env]);
}

function useSyncClientAuthRef(): SyncClientAuth {
  const accountId = useCurrentAccountId();
  const deviceId = useDeviceId();
  const sessionToken = useFreshAuthToken();
  const accountIdRef = useRef(accountId);
  const deviceIdRef = useRef(deviceId);
  const sessionTokenRef = useRef(sessionToken);
  accountIdRef.current = accountId;
  deviceIdRef.current = deviceId;
  sessionTokenRef.current = sessionToken;
  return useMemo(
    () => ({
      getAccountId: () => accountIdRef.current,
      getDeviceId: () => deviceIdRef.current,
      getSessionToken: () => sessionTokenRef.current,
    }),
    []
  );
}

function useSyncEnginePromise(
  dbName: string,
  userId: string,
  pool: AppSyncEnginePool
): Promise<SyncEngine> {
  const env = useClientEnv();
  const embedded = useEmbeddedApp();
  const config = useConfigService();
  const observability = useObservability();
  const originAvailability = useOptionalOriginAvailability();
  const getFreshAuthToken = useGetFreshAuthToken();
  const auth = useSyncClientAuthRef();
  const fetchFn = useMemo(
    () => instrumentFetch(observability, env.server) as SyncApiFetch,
    [observability, env]
  );
  const configRef = useRef(config);
  const fetchFnRef = useRef(fetchFn);
  const getFreshAuthTokenRef = useRef(getFreshAuthToken);
  const authRef = useRef(auth);
  const envRef = useRef(env);
  configRef.current = config;
  fetchFnRef.current = fetchFn;
  getFreshAuthTokenRef.current = getFreshAuthToken;
  authRef.current = auth;
  envRef.current = env;

  const simEvents = env.serverUrl === SIM_SERVER_URL;

  return useMemo(
    () =>
      pool.getOrCreate({
        openSqlClient: (args) => envRef.current.openSqlClient(args),
        ...(simEvents
          ? {
              createPubSub: () => envRef.current.createPubSub(),
            }
          : {}),
        get config() {
          return configRef.current;
        },
        get fetchFn() {
          return fetchFnRef.current;
        },
        get auth() {
          return authRef.current;
        },
        get clock() {
          return envRef.current.clock;
        },
        get timers() {
          return envRef.current.timers;
        },
        get createId() {
          return envRef.current.createId;
        },
        get random() {
          return envRef.current.random;
        },
        getFreshAuthToken: (options) => getFreshAuthTokenRef.current(options),
        databaseName: dbName,
        userId,
        ...(originAvailability?.kind === 'health'
          ? {
              waitUntilAvailable: (signal?: AbortSignal | null) =>
                originAvailability.waitUntilAvailable(signal),
            }
          : {}),
      }),
    [dbName, userId, pool, simEvents, originAvailability, embedded]
  );
}

function renderSyncEngineTree(args: {
  readonly paintReady: boolean;
  readonly engine: SyncEngine;
  readonly databaseName: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <SyncEnginePaintGateContext.Provider value={args.paintReady}>
      <SyncEngineProvider value={args.engine}>
        <SqlClientProvider value={args.engine.db}>
          <AppObservabilityFromClientConfig>
            <SyncEmqxPushFromClientConfig databaseName={args.databaseName} />
            {args.children}
          </AppObservabilityFromClientConfig>
        </SqlClientProvider>
      </SyncEngineProvider>
    </SyncEnginePaintGateContext.Provider>
  );
}

/**
 * Opens local SQLite for the active `users.id` and exposes the sync engine.
 *
 * Waits for AuthBridge anon ensure / refresh to bind `currentUserId`. After
 * the first successful open, keeps the navigation tree mounted while the same
 * identity reconnects (sticky prior engine). Across identity / database-name
 * changes the prior engine is closed (web OPFS) so the tree shows loading
 * until the next engine is ready.
 */
export function SyncEngineBoot({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const userId = useCurrentAccountId();
  if (userId === null) {
    return <LocalDatabaseBootLoadingScreen />;
  }

  return (
    <SyncEngineBootWithUser userId={userId}>{children}</SyncEngineBootWithUser>
  );
}

function SyncEngineBootWithUser({
  userId,
  children,
}: {
  readonly userId: string;
  readonly children: ReactNode;
}): ReactNode {
  const embedded = useEmbeddedApp();
  const dbName = useIdentitySqliteDbName(userId);
  const pool = useSyncEnginePool();
  const warmEngine = pool.peekReady(dbName);
  const lastReadyEngineRef = useRef<SyncEngine | null>(warmEngine);
  const lastDbNameRef = useRef(dbName);
  const lastPoolRef = useRef(pool);
  // Identity switch closes the prior SQLite handle (web OPFS). Never keep the
  // old engine sticky across database names — its connection is gone.
  // Playground also swaps the isolated pool on snapshot restore; sticky would
  // keep serving a closed sqlite-mem client across that boundary.
  if (lastDbNameRef.current !== dbName || lastPoolRef.current !== pool) {
    lastDbNameRef.current = dbName;
    lastPoolRef.current = pool;
    lastReadyEngineRef.current = warmEngine;
  }
  const enginePromise = useSyncEnginePromise(dbName, userId, pool);
  const boot = useSyncEngineBootState(enginePromise, warmEngine);

  if (boot.phase === 'ready') {
    lastReadyEngineRef.current = boot.engine;
  }

  const paintReady = boot.phase === 'ready';
  // Embedded playground: never paint a sticky prior engine — snapshot restore
  // closes the prior sqlite-mem handle while React may still be remounting.
  const engine =
    boot.phase === 'ready'
      ? boot.engine
      : embedded
        ? null
        : lastReadyEngineRef.current;

  if (engine === null) {
    if (boot.phase === 'error') {
      return <LocalDatabaseBootErrorScreen error={boot.error} />;
    }
    return <LocalDatabaseBootLoadingScreen />;
  }

  if (boot.phase === 'error') {
    return <LocalDatabaseBootErrorScreen error={boot.error} />;
  }

  return renderSyncEngineTree({
    paintReady,
    engine,
    databaseName: dbName,
    children,
  });
}
