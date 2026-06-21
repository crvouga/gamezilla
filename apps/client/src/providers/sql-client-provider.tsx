import { useCachedPromise } from '@pkgs/async/use-cached-promise';
import { SqlClientProvider as SqlClientCtxProvider } from '@pkgs/sql-client/react-context';
import { useEffect, useState, type ReactNode } from 'react';

import {
  getMainSqliteDbName,
  openMainSqlClient,
} from '../storage/open-main-sql-client';
import {
  LocalDatabaseBootErrorScreen,
  LocalDatabaseBootLoadingScreen,
} from './local-database-boot-screen';

type BootState =
  | { phase: 'loading' }
  | { phase: 'ready'; sql: Awaited<ReturnType<typeof openMainSqlClient>> }
  | { phase: 'error'; error: Error };

/**
 * Opens the single shared `main` SQLite database once per app instance and
 * exposes the resulting `SqlClient` via {@link SqlClientCtxProvider}. Consumers
 * (most notably `PatchDbProvider`) read it through `useSqlClient()`.
 *
 * Uses explicit boot phases instead of `React.use()` so OPFS lock / recovery
 * failures surface a recovery screen instead of an infinite Suspense spinner.
 */
export function SqlClientProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [boot, setBoot] = useState<BootState>({ phase: 'loading' });

  const sqlPromise = useCachedPromise(
    // eslint-disable-next-line lingui/no-unlocalized-strings -- Internal cache key, not user-facing.
    `sql-client:${getMainSqliteDbName()}`,
    () => openMainSqlClient()
  );

  useEffect(() => {
    let cancelled = false;
    void sqlPromise.then(
      (sql) => {
        if (!cancelled) {
          // eslint-disable-next-line lingui/no-unlocalized-strings -- internal boot phase, not user-facing
          setBoot({ phase: 'ready', sql });
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
  }, [sqlPromise]);

  if (boot.phase === 'loading') {
    return <LocalDatabaseBootLoadingScreen />;
  }
  if (boot.phase === 'error') {
    return <LocalDatabaseBootErrorScreen error={boot.error} />;
  }

  return (
    <SqlClientCtxProvider value={boot.sql}>{children}</SqlClientCtxProvider>
  );
}
