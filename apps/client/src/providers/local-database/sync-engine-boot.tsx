import { useConfigService } from '@libs/auth/public/config-service-context';
import { useCurrentAccountId } from '@libs/auth/public/use-current-account-id';
import { useDeviceId } from '@libs/auth/public/use-device-id';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth/public/use-fresh-auth-token';
import { useHttpClient } from '@pkgs/http-client';
import { useIo } from '@pkgs/io';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { SqlClientProvider } from '@pkgs/sql-client/react-context';
import {
  type SyncEngine,
  SyncEnginePaintGateContext,
  SyncEngineProvider,
} from '@pkgs/sync-engine/client';
import { type ReactNode, useMemo, useRef } from 'react';

import { getMainSqliteDbName } from '../../storage/open-main-sql-client';
import type { SyncApiFetch, SyncClientAuth } from '../../sync/sync-api';
import {
  type AppSyncEnginePool,
  defaultAppSyncEnginePool,
} from '../../sync/sync-engine-pool';
import { useClientSystemResources } from '../client-system-resources';
import { useEmbeddedApp } from '../embedded-app-context';
import { AppObservabilityFromClientConfig } from './app-observability-from-client-config';
import {
  LocalDatabaseBootErrorScreen,
  LocalDatabaseBootLoadingScreen,
} from './boot-screens';
import { SyncEmqxPushFromClientConfig } from './sync-emqx-push-from-client-config';
import { useSyncEngineBootState } from './use-sync-engine-boot-state';

function useIdentitySqliteDbName(userId: string): string {
  const createId = useIo().createId;
  const resolveDatabaseName = useClientSystemResources().resolveDatabaseName;
  return useMemo(
    () =>
      resolveDatabaseName !== undefined
        ? resolveDatabaseName({ userId, createId })
        : getMainSqliteDbName(userId, createId),
    [userId, createId, resolveDatabaseName]
  );
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
  const resources = useClientSystemResources();
  const { openSqlClient, createPubSub, syncEnginePool } = resources;
  const embedded = useEmbeddedApp();
  const config = useConfigService();
  const observability = useObservability();
  const io = useIo();
  const { fetch: httpFetch } = useHttpClient();
  const getFreshAuthToken = useGetFreshAuthToken();
  const auth = useSyncClientAuthRef();
  const fetchFn = useMemo(
    () => instrumentFetch(observability, httpFetch) as SyncApiFetch,
    [observability, httpFetch]
  );
  const configRef = useRef(config);
  const fetchFnRef = useRef(fetchFn);
  const getFreshAuthTokenRef = useRef(getFreshAuthToken);
  const authRef = useRef(auth);
  const ioRef = useRef(io);
  const createPubSubRef = useRef(createPubSub);
  configRef.current = config;
  fetchFnRef.current = fetchFn;
  getFreshAuthTokenRef.current = getFreshAuthToken;
  authRef.current = auth;
  ioRef.current = io;
  createPubSubRef.current = createPubSub;

  if (
    (embedded || syncEnginePool !== undefined) &&
    openSqlClient === undefined
  ) {
    throw new Error(
      'SyncEngineBoot: embedded / sim hosts must inject openSqlClient (never fall through to OPFS)'
    );
  }

  return useMemo(
    () =>
      pool.getOrCreate({
        ...(openSqlClient !== undefined ? { openSqlClient } : {}),
        ...(createPubSub !== undefined
          ? {
              createPubSub: () => {
                const factory = createPubSubRef.current;
                if (factory === undefined) {
                  throw new Error('createPubSub override missing');
                }
                return factory();
              },
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
          return ioRef.current.clock;
        },
        get timers() {
          return ioRef.current.timers;
        },
        get createId() {
          return ioRef.current.createId;
        },
        get random() {
          return ioRef.current.random;
        },
        getFreshAuthToken: (options) => getFreshAuthTokenRef.current(options),
        databaseName: dbName,
        userId,
      }),
    [dbName, userId, pool, openSqlClient, createPubSub]
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
  const pool =
    useClientSystemResources().syncEnginePool ?? defaultAppSyncEnginePool;
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
