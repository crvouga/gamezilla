import { useConfigService } from '@libs/auth/client/config-service-context';
import { useDeviceId } from '@libs/auth/client/use-device-id';
import { useCachedPromise } from '@pkgs/async/use-cached-promise';
import { instrumentFetch } from '@pkgs/observability/client/instrument-fetch';
import { useObservability } from '@pkgs/observability/client/observability-provider';
import { useSqlClient } from '@pkgs/sql-client/react-context';
import { PatchDbContextProvider } from '@pkgs/patch-db/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { createPatchDb } from '../../patch-db/create-patch-db';
import { getMainSqliteDbName } from '../../storage/open-main-sql-client';
import {
  LocalDatabaseBootErrorScreen,
  LocalDatabaseBootLoadingScreen,
} from './boot-screens';

type BootState =
  | { phase: 'loading' }
  | { phase: 'ready'; value: Awaited<ReturnType<typeof createPatchDb>> }
  | { phase: 'error'; error: Error };

/**
 * Builds patch-db once per app instance on top of the shared SQL client.
 */
export function PatchDbBoot({ children }: { children: ReactNode }): ReactNode {
  const sql = useSqlClient();
  const config = useConfigService();
  const observability = useObservability();
  const fetchFn = useMemo(
    () => instrumentFetch(observability, fetch),
    [observability]
  );
  useDeviceId();

  const patchDbPromise = useCachedPromise(
    // eslint-disable-next-line lingui/no-unlocalized-strings -- Internal cache key, not user-facing.
    `patch-db:${getMainSqliteDbName()}`,
    () =>
      createPatchDb({
        sql,
        config,
        fetchFn,
      })
  );

  const [boot, setBoot] = useState<BootState>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void patchDbPromise.then(
      (value) => {
        if (!cancelled) {
          // eslint-disable-next-line lingui/no-unlocalized-strings -- internal boot phase, not user-facing
          setBoot({ phase: 'ready', value });
        }
      },
      (error: unknown) => {
        if (cancelled) return;
        const err = error instanceof Error ? error : new Error(String(error));
        // eslint-disable-next-line lingui/no-unlocalized-strings -- internal boot phase, not user-facing
        setBoot({ phase: 'error', error: err });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [patchDbPromise]);

  if (boot.phase === 'loading') {
    return <LocalDatabaseBootLoadingScreen />;
  }
  if (boot.phase === 'error') {
    return <LocalDatabaseBootErrorScreen error={boot.error} />;
  }

  return (
    <PatchDbContextProvider value={boot.value}>
      {children}
    </PatchDbContextProvider>
  );
}
