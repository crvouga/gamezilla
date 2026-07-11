import { clearWatchQueryCache } from '@pkgs/sync-engine/client/watch-query-cache';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { useLayoutEffect, type ReactNode } from 'react';

import { registerSyncIdentityFlush } from './sync-identity-flush';

/**
 * Registers the sign-in identity flush handler (invoked from {@link AuthBridge}
 * after a successful `/auth/refresh`). Wipes anonymous local rows, reconnects,
 * and waits for the account-scoped first sync — never on cold start.
 */
export function AuthSyncBridge({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const engine = useSyncEngine();

  useLayoutEffect(() => {
    return registerSyncIdentityFlush(async () => {
      await engine.clearLocalData();
      clearWatchQueryCache();
      await engine.connect();
      await engine.waitForFirstSync();
    });
  }, [engine]);

  return children;
}
