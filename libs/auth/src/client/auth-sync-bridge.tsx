import type { ReactNode } from 'react';

/**
 * Marker provider kept for composition stability. Identity transitions remount
 * {@link SyncEngineBoot}. No longer registers a clearLocalData flush
 * (per-account SQLite files isolate data).
 */
export function AuthSyncBridge({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return children;
}
