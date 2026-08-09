import { useConfigService } from '@libs/auth/client/config-service-context';
import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import {
  useFreshAuthToken,
  useGetFreshAuthToken,
} from '@libs/auth/client/use-fresh-auth-token';
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
  getOrCreateAppLocalSyncEngine,
  peekReadyAppSyncEngine,
} from '../../sync/sync-engine-pool';
import {
  LocalDatabaseBootErrorScreen,
  LocalDatabaseBootLoadingScreen,
} from './boot-screens';
import { useSyncEngineBootState } from './use-sync-engine-boot-state';

function useIdentitySqliteDbName(userId: string): string {
  const createId = useIo().createId;
  return useMemo(
    () => getMainSqliteDbName(userId, createId),
    [userId, createId]
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
  userId: string
): Promise<SyncEngine> {
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
  configRef.current = config;
  fetchFnRef.current = fetchFn;
  getFreshAuthTokenRef.current = getFreshAuthToken;
  authRef.current = auth;
  ioRef.current = io;
  return useMemo(
    () =>
      getOrCreateAppLocalSyncEngine({
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
    [dbName, userId]
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
 * Opens local SQLite for the active `users.id` and exposes the sync engine.
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
  const enginePromise = useSyncEnginePromise(dbName, userId);
  const boot = useSyncEngineBootState(enginePromise, warmEngine);

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
