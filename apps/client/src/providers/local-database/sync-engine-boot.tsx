import { useReportSyncBootPhase } from '@libs/auth/client/account-switch/account-switch-context';
import { useConfigService } from '@libs/auth/client/config-service-context';
import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useKv } from '@pkgs/kv/kv-context';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { SyncEngineProvider } from '@pkgs/sync-engine/client/sync-engine-context';
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

/**
 * Opens PowerSync for the active auth identity and exposes the sync engine.
 *
 * After the first successful open, keep the navigation tree mounted across
 * identity changes (sticky prior engine until the next one is ready). Replacing
 * children with a loading screen unmounts Expo Router and resets to `/`.
 */
export function SyncEngineBoot({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const config = useConfigService();
  const kv = useKv();
  const observability = useObservability();
  const accountId = useCurrentAccountId();
  const deviceId = useDeviceId();
  const fetchFn = useMemo(
    () => instrumentFetch(observability, fetch) as SyncApiFetch,
    [observability]
  );
  const dbName = useIdentitySqliteDbName(accountId, deviceId);
  const warmEngine = peekReadyAppSyncEngine(dbName);
  const configRef = useRef(config);
  const fetchFnRef = useRef(fetchFn);
  const kvRef = useRef(kv);
  const lastReadyEngineRef = useRef<SyncEngine | null>(warmEngine);
  configRef.current = config;
  fetchFnRef.current = fetchFn;
  kvRef.current = kv;
  // Only recreate when the identity-scoped DB name changes. config/fetch/kv are
  // read via refs so unstable identities cannot thrash getOrCreate every render.
  const enginePromise = useMemo(
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
  const boot = useSyncEngineBootState(enginePromise, warmEngine);
  useReportBootPhaseUp(boot.phase, accountId);

  if (boot.phase === 'ready') {
    lastReadyEngineRef.current = boot.engine;
  }

  const engine =
    boot.phase === 'ready' ? boot.engine : lastReadyEngineRef.current;

  // First open only — nothing sticky to keep the router alive yet.
  if (engine === null) {
    if (boot.phase === 'error') {
      return <LocalDatabaseBootErrorScreen error={boot.error} />;
    }
    return <LocalDatabaseBootLoadingScreen />;
  }

  if (boot.phase === 'error') {
    return <LocalDatabaseBootErrorScreen error={boot.error} />;
  }

  return (
    <SyncEngineProvider value={engine}>
      <SqlClientProvider value={engine.db}>{children}</SqlClientProvider>
    </SyncEngineProvider>
  );
}
