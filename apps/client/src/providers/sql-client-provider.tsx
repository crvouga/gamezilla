import { useCachedPromise } from '@pkgs/async/use-cached-promise';
import { SqlClientProvider as SqlClientCtxProvider } from '@pkgs/sql-client/react-context';
import { use, type ReactNode } from 'react';

import {
  getMainSqliteDbName,
  openMainSqlClient,
} from '../storage/open-main-sql-client';

/**
 * Opens the single shared `main` SQLite database once per app instance and
 * exposes the resulting `SqlClient` via {@link SqlClientCtxProvider}. Consumers
 * (most notably `PatchDbProvider`) read it through `useSqlClient()`.
 *
 * The promise is cached via `useCachedPromise` so React's Suspense retry path
 * keeps seeing the same reference (otherwise `use()` would loop).
 */
export function SqlClientProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const sqlPromise = useCachedPromise(
    // eslint-disable-next-line lingui/no-unlocalized-strings -- Internal cache key, not user-facing.
    `sql-client:${getMainSqliteDbName()}`,
    () => openMainSqlClient()
  );
  const sql = use(sqlPromise);

  return <SqlClientCtxProvider value={sql}>{children}</SqlClientCtxProvider>;
}
