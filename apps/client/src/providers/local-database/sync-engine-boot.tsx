import {
  useIsAccountSwitchPending,
  useReportSyncBootPhase,
} from '@libs/auth/client/account-switch/account-switch-context';
import { useConfigService } from '@libs/auth/client/config-service-context';
import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useKv } from '@pkgs/kv/kv-context';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { SyncEngineProvider } from '@pkgs/sync-engine/client/sync-engine-context';
import { SqlClientProvider } from '@pkgs/sql-client/react-context';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { createAppPowerSyncSyncEngine } from '../../sync/create-powersync-sync-engine';
import type { SyncApiFetch } from '../../sync/sync-api';
import { resolveSqliteDbName } from '../../storage/resolve-sqlite-db-name';
import {
  LocalDatabaseBootErrorScreen,
  LocalDatabaseBootLoadingScreen,
  LocalDatabaseBootSwitchHold,
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
 * Remounts when the account (or anon) identity changes. Local UI is ready as
 * soon as the identity DB opens; sync connects in the background.
 *
 * Engine promises are recreated per identity activation — a process-lifetime
 * cache would reuse SyncEngines whose OPFS DB was disconnected when another
 * account became active (only one live PowerSync DB is allowed).
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
  const switchPending = useIsAccountSwitchPending();
  const fetchFn = useMemo(
    () => instrumentFetch(observability, fetch) as SyncApiFetch,
    [observability]
  );
  const dbName = useIdentitySqliteDbName(accountId, deviceId);
  const enginePromise = useMemo(
    () =>
      createAppPowerSyncSyncEngine({
        config,
        fetchFn,
        kv,
        databaseName: dbName,
      }),
    [dbName, config, fetchFn, kv]
  );
  const boot = useSyncEngineBootState(enginePromise);
  useReportBootPhaseUp(boot.phase, accountId);

  if (boot.phase === 'loading') {
    if (switchPending) return <LocalDatabaseBootSwitchHold />;
    return <LocalDatabaseBootLoadingScreen />;
  }
  if (boot.phase === 'error') {
    return <LocalDatabaseBootErrorScreen error={boot.error} />;
  }

  return (
    <SyncEngineProvider value={boot.engine}>
      <SqlClientProvider value={boot.engine.db}>{children}</SqlClientProvider>
    </SyncEngineProvider>
  );
}
