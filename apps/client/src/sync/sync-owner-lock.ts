import { Platform } from 'react-native';

/**
 * Per-database Web Lock so only one tab runs sync upload/push against a
 * shared local SQLite database.
 */
export function syncOwnerLockName(dbName: string): string {
  return `sync-owner:${dbName}`;
}

export type SyncOwnerLease = {
  readonly isOwner: boolean;
  /** Release the lock (no-op for followers / native). */
  readonly release: () => void;
};

/**
 * Try to become the sync owner for `dbName`. Non-web platforms always own.
 * Followers get `isOwner: false`; Web Locks auto-release on tab death so a
 * follower can retry later if needed.
 */
export async function tryAcquireSyncOwnerLease(
  dbName: string
): Promise<SyncOwnerLease> {
  if (Platform.OS !== 'web') {
    return { isOwner: true, release: () => undefined };
  }
  const locks = navigator.locks;
  if (locks === undefined) {
    return { isOwner: true, release: () => undefined };
  }

  return new Promise<SyncOwnerLease>((resolve) => {
    void locks.request(
      syncOwnerLockName(dbName),
      { mode: 'exclusive', ifAvailable: true },
      (lock) => {
        if (lock === null) {
          resolve({ isOwner: false, release: () => undefined });
          return;
        }
        let released = false;
        let releaseHold: (() => void) | null = null;
        resolve({
          isOwner: true,
          release: () => {
            if (released) return;
            released = true;
            releaseHold?.();
          },
        });
        return new Promise<void>((release) => {
          releaseHold = release;
        });
      }
    );
  });
}
