import { useConfigService } from '@libs/auth/client/config-service-context';
import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth/client/use-fresh-auth-token';
import { useKv } from '@pkgs/kv/kv-context';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { SyncEngineProvider } from '@pkgs/sync-engine/client/sync-engine-context';
import { SyncEnginePaintGateContext } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';
import { SqlClientProvider } from '@pkgs/sql-client/react-context';
import { useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { resolveSqliteDbName } from '../../storage/resolve-sqlite-db-name';
import type { SyncApiFetch, SyncClientAuth } from '../../sync/sync-api';
import {
  getOrCreateAppPowerSyncSyncEngine,
  peekReadyAppSyncEngine,
} from '../../sync/sync-engine-pool';
import {
  LocalDatabaseBootErrorScreen,
  LocalDatabaseBootLoadingScreen,
} from './boot-screens';
import { useSyncEngineBootState } from './use-sync-engine-boot-state';

const WEB_TAB_DB_ID_KEY = 'main-sqlite-tab-id';

function readOrCreateWebTabDbId(): string {
  const existing = sessionStorage.getItem(WEB_TAB_DB_ID_KEY);
  if (existing !== null && existing.length > 0) return existing;
  const id = crypto.randomUUID().replace(/-/g, '');
  sessionStorage.setItem(WEB_TAB_DB_ID_KEY, id);
  return id;
}

function useIdentitySqliteDbName(userId: string): string {
  return useMemo(() => {
    const webTabSuffix =
      Platform.OS === 'web' && typeof sessionStorage !== 'undefined'
        ? readOrCreateWebTabDbId()
        : undefined;
    return resolveSqliteDbName({
      userId,
      ...(webTabSuffix !== undefined ? { webTabSuffix } : {}),
    });
  }, [userId]);
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

function useSyncEnginePromise(dbName: string): Promise<SyncEngine> {
  const config = useConfigService();
  const kv = useKv();
  const observability = useObservability();
  const getFreshAuthToken = useGetFreshAuthToken();
  const auth = useSyncClientAuthRef();
  const fetchFn = useMemo(
    () =>
      instrumentFetch(
        observability,
        globalThis.fetch.bind(globalThis)
      ) as SyncApiFetch,
    [observability]
  );
  const configRef = useRef(config);
  const fetchFnRef = useRef(fetchFn);
  const kvRef = useRef(kv);
  const getFreshAuthTokenRef = useRef(getFreshAuthToken);
  const authRef = useRef(auth);
  configRef.current = config;
  fetchFnRef.current = fetchFn;
  kvRef.current = kv;
  getFreshAuthTokenRef.current = getFreshAuthToken;
  authRef.current = auth;
  return useMemo(
    () =>
      getOrCreateAppPowerSyncSyncEngine({
        get config() {
          return configRef.current;
        },
        get fetchFn() {
          return fetchFnRef.current;
        },
        get kv() {
          return kvRef.current;
        },
        get auth() {
          return authRef.current;
        },
        getFreshAuthToken: () => getFreshAuthTokenRef.current(),
        databaseName: dbName,
      }),
    [dbName]
  );
}

function renderSyncEngineTree(args: {
  readonly paintReady: boolean;
  readonly engine: SyncEngine;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <SyncEnginePaintGateContext.Provider value={args.paintReady}>
      <SyncEngineProvider value={args.engine}>
        <SqlClientProvider value={args.engine.db}>
          {args.children}
        </SqlClientProvider>
      </SyncEngineProvider>
    </SyncEnginePaintGateContext.Provider>
  );
}

/**
 * Opens PowerSync for the active `users.id` and exposes the sync engine.
 *
 * Waits for AuthBridge anon ensure / refresh to bind `currentUserId`. After
 * the first successful open, keeps the navigation tree mounted across identity
 * changes (sticky prior engine until the next one is ready).
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
  const dbName = useIdentitySqliteDbName(userId);
  const warmEngine = peekReadyAppSyncEngine(dbName);
  const lastReadyEngineRef = useRef<SyncEngine | null>(warmEngine);
  const enginePromise = useSyncEnginePromise(dbName);
  const boot = useSyncEngineBootState(enginePromise, warmEngine, userId);

  if (boot.phase === 'ready') {
    lastReadyEngineRef.current = boot.engine;
  }

  const paintReady = boot.phase === 'ready';
  const engine =
    boot.phase === 'ready' ? boot.engine : lastReadyEngineRef.current;

  if (engine === null) {
    if (boot.phase === 'error') {
      return <LocalDatabaseBootErrorScreen error={boot.error} />;
    }
    return <LocalDatabaseBootLoadingScreen />;
  }

  if (boot.phase === 'error') {
    return <LocalDatabaseBootErrorScreen error={boot.error} />;
  }

  return renderSyncEngineTree({ paintReady, engine, children });
}
