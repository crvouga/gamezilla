import { useCachedPromise } from '@pkgs/async/use-cached-promise';
import { SqlClientProvider as SqlClientCtxProvider } from '@pkgs/sql-client/react-context';
import { useEffect, useState, type ReactNode } from 'react';

import {
  getMainSqliteDbName,
  openMainSqlClient,
} from '../../storage/open-main-sql-client';
import {
  LocalDatabaseBootErrorScreen,
  LocalDatabaseBootLoadingScreen,
} from './boot-screens';

type BootState =
  | { phase: 'loading' }
  | { phase: 'ready'; sql: Awaited<ReturnType<typeof openMainSqlClient>> }
  | { phase: 'error'; error: Error };

/**
 * Opens the single shared `main` SQLite database once per app instance and
 * exposes the resulting `SqlClient` via {@link SqlClientCtxProvider}.
 */
export function SqlClientBoot({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [boot, setBoot] = useState<BootState>({ phase: 'loading' });

  const sqlPromise = useCachedPromise(
    `sql-client:${getMainSqliteDbName()}` as const,
    () => openMainSqlClient()
  );

  useEffect(() => {
    let cancelled = false;
    void sqlPromise.then(
      (sql) => {
        if (!cancelled) {
          setBoot({ phase: 'ready' as const, sql });
        }
      },
      (error: unknown) => {
        if (cancelled) return;
        const err = error instanceof Error ? error : new Error(String(error));
        setBoot({ phase: 'error' as const, error: err });
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
