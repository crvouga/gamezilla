import { useReportSyncBootPhase } from '@libs/auth/client/account-switch/account-switch-context';
import { useConfigService } from '@libs/auth/client/config-service-context';
import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useKv } from '@pkgs/kv/kv-context';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { SyncEngineProvider } from '@pkgs/sync-engine/client/sync-engine-context';
import { SyncEnginePaintGateContext } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';
import { SqlClientProvider } from '@pkgs/sql-client/react-context';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { resolveSqliteDbName } from '../../storage/resolve-sqlite-db-name';
import type { SyncApiFetch } from '../../sync/sync-api';
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

function useIdentitySqliteDbName(
  accountId: string | null,
  deviceId: string
): string {
  return useMemo(() => {
    const webTabSuffix =
      Platform.OS === 'web' && typeof sessionStorage !== 'undefined'
        ? readOrCreateWebTabDbId()
        : undefined;
    return resolveSqliteDbName({
      accountId,
      deviceId,
      ...(webTabSuffix !== undefined ? { webTabSuffix } : {}),
    });
  }, [accountId, deviceId]);
}

function useReportBootPhaseUp(
  phase: 'loading' | 'ready' | 'error',
  accountId: string | null
): void {
  const report = useReportSyncBootPhase();
  useEffect(() => {
    report(phase, accountId);
  }, [report, phase, accountId]);
}

function useSyncEnginePromise(dbName: string): Promise<SyncEngine> {
  const config = useConfigService();
  const kv = useKv();
  const observability = useObservability();
  const fetchFn = useMemo(
    () => instrumentFetch(observability, fetch) as SyncApiFetch,
    [observability]
  );
  const configRef = useRef(config);
  const fetchFnRef = useRef(fetchFn);
  const kvRef = useRef(kv);
  configRef.current = config;
  fetchFnRef.current = fetchFn;
  kvRef.current = kv;
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
 * Opens PowerSync for the active auth identity and exposes the sync engine.
 *
 * After the first successful open, keep the navigation tree mounted across
 * identity changes (sticky prior engine until the next one is ready). Replacing
 * children with a loading screen unmounts Expo Router and resets to `/`.
 * Space chrome (miniplayer / current spaces) must not paint from a sticky
 * prior-account engine — see {@link SyncEnginePaintGateContext}.
 */
export function SyncEngineBoot({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const accountId = useCurrentAccountId();
  const deviceId = useDeviceId();
  const dbName = useIdentitySqliteDbName(accountId, deviceId);
  const warmEngine = peekReadyAppSyncEngine(dbName);
  const lastReadyEngineRef = useRef<SyncEngine | null>(warmEngine);
  const enginePromise = useSyncEnginePromise(dbName);
  const boot = useSyncEngineBootState(enginePromise, warmEngine);
  useReportBootPhaseUp(boot.phase, accountId);

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
