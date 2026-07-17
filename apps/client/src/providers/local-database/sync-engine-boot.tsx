import { useConfigService } from '@libs/auth/client/config-service-context';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useCachedPromise } from '@pkgs/async/use-cached-promise';
import { useKv } from '@pkgs/kv/kv-context';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { SyncEngineProvider } from '@pkgs/sync-engine/client/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';
import { SqlClientProvider } from '@pkgs/sql-client/react-context';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { attachSqlCli } from '../../dev/attach-sql-cli';
import { createAppPowerSyncSyncEngine } from '../../sync/create-powersync-sync-engine';
import type { SyncApiFetch } from '../../sync/sync-api';
import { getMainSqliteDbName } from '../../storage/open-main-sql-client';
import {
  LocalDatabaseBootErrorScreen,
  LocalDatabaseBootLoadingScreen,
} from './boot-screens';

type BootState =
  | { phase: 'loading' }
  | { phase: 'ready'; engine: SyncEngine }
  | { phase: 'error'; error: Error };

/**
 * Opens PowerSync once per app instance, connects to the sync service, and
 * exposes the {@link SyncEngine} port to the tree.
 */
export function SyncEngineBoot({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const config = useConfigService();
  const kv = useKv();
  const observability = useObservability();
  const fetchFn = useMemo(
    () => instrumentFetch(observability, fetch) as SyncApiFetch,
    [observability]
  );
  useDeviceId();

  const enginePromise = useCachedPromise(
    `sync-engine:${getMainSqliteDbName()}`,
    () =>
      createAppPowerSyncSyncEngine({
        config,
        fetchFn,
        kv,
      })
  );

  const [boot, setBoot] = useState<BootState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void enginePromise.then(
      (engine) => {
        if (cancelled) return;
        void engine.connect().then(
          () => {
            if (!cancelled) {
              attachSqlCli(engine.db);
              setBoot({ phase: 'ready', engine });
            }
          },
          (error: unknown) => {
            if (cancelled) return;
            const err =
              error instanceof Error ? error : new Error(String(error));
            setBoot({ phase: 'error', error: err });
          }
        );
      },
      (error: unknown) => {
        if (cancelled) return;
        const err = error instanceof Error ? error : new Error(String(error));
        setBoot({ phase: 'error', error: err });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enginePromise]);

  if (boot.phase === 'loading') {
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
