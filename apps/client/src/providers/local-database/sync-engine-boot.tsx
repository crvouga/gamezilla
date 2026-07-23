import { useConfigService } from '@libs/auth/client/config-service-context';
import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useCachedPromise } from '@pkgs/async/use-cached-promise';
import { useKv } from '@pkgs/kv/kv-context';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { SyncEngineProvider } from '@pkgs/sync-engine/client/sync-engine-context';
import { SqlClientProvider } from '@pkgs/sql-client/react-context';
import { useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { createAppPowerSyncSyncEngine } from '../../sync/create-powersync-sync-engine';
import type { SyncApiFetch } from '../../sync/sync-api';
import { resolveSqliteDbName } from '../../storage/resolve-sqlite-db-name';
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

/**
 * Opens PowerSync for the active auth identity and exposes the sync engine.
 * Remounts when the account (or anon) identity changes. Local UI is ready as
 * soon as the identity DB opens; sync connects in the background.
 */
export function SyncEngineBoot({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { t } = useLingui();
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
  const enginePromise = useCachedPromise(`sync-engine:${dbName}`, () =>
    createAppPowerSyncSyncEngine({
      config,
      fetchFn,
      kv,
      databaseName: dbName,
    })
  );
  const boot = useSyncEngineBootState(enginePromise);

  if (boot.phase === 'loading') {
    return (
      <LocalDatabaseBootLoadingScreen
        {...(accountId !== null ? { caption: t`Switching account…` } : {})}
      />
    );
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
