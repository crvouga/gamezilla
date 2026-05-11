import { useCachedPromise } from '@gamezilla/lib/async/use-cached-promise';
import { SqlClientProvider as SqlClientCtxProvider } from '@gamezilla/lib/sql-client/react-context';
import { use, useEffect, useRef, type ReactNode } from 'react';

import {
  MAIN_SQLITE_DB_NAME,
  openMainSqlClient,
} from '../storage/open-main-sql-client';

// #region agent log
function debugLog(message: string, data: Record<string, unknown>): void {
  fetch('http://127.0.0.1:7510/ingest/c52c9028-9c01-42a4-9186-01f9b18984a5', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '165003',
    },
    body: JSON.stringify({
      sessionId: '165003',
      location: 'sql-client-provider.tsx',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
let __sqlProviderRenderCount = 0;
let __sqlProviderInstanceCount = 0;
// #endregion

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
  // #region agent log
  __sqlProviderRenderCount += 1;
  const renderCount = __sqlProviderRenderCount;
  const instanceIdRef = useRef<number | null>(null);
  if (instanceIdRef.current === null) {
    __sqlProviderInstanceCount += 1;
    instanceIdRef.current = __sqlProviderInstanceCount;
  }
  debugLog('SqlClientProvider render', {
    hypothesisId: 'A,B,D',
    renderCount,
    instanceId: instanceIdRef.current,
  });
  useEffect(() => {
    debugLog('SqlClientProvider mounted', {
      hypothesisId: 'A',
      instanceId: instanceIdRef.current,
    });
    return () => {
      debugLog('SqlClientProvider unmounted', {
        hypothesisId: 'A',
        instanceId: instanceIdRef.current,
      });
    };
  }, []);
  // #endregion

  const sqlPromise = useCachedPromise(MAIN_SQLITE_DB_NAME, () => {
    // #region agent log
    debugLog('factory called: openMainSqlClient', {
      hypothesisId: 'A,B,C,D',
      instanceId: instanceIdRef.current,
      renderCount,
    });
    // #endregion
    return openMainSqlClient();
  });
  const sql = use(sqlPromise);

  // #region agent log
  debugLog('SqlClientProvider use(promise) resolved', {
    hypothesisId: 'A,B,D',
    instanceId: instanceIdRef.current,
    renderCount,
  });
  // #endregion

  return <SqlClientCtxProvider value={sql}>{children}</SqlClientCtxProvider>;
}
