/**
 * Per-database Web Lock so only one tab runs sync upload/push against a
 * shared local SQLite database. Hosts without `navigator.locks` (happy-dom,
 * some test runtimes) always own.
 */

export function syncOwnerLockName(dbName: string): string {
  return `sync-owner:${dbName}`;
}

export type SyncOwnerLease = {
  readonly isOwner: boolean;
  /** Release the lock (no-op for followers). */
  readonly release: () => void;
};

const OWNER_WITHOUT_LOCK: SyncOwnerLease = {
  isOwner: true,
  release: () => undefined,
};

type LockManagerLike = {
  request(
    name: string,
    options: { mode: 'exclusive'; ifAvailable: true },
    callback: (lock: unknown) => Promise<void> | void
  ): Promise<unknown>;
};

function readLockManager(): LockManagerLike | null {
  const nav = (globalThis as { navigator?: { locks?: unknown } }).navigator;
  const locks = nav?.locks;
  if (locks === undefined || locks === null) return null;
  return locks as LockManagerLike;
}

function heldLease(): {
  readonly lease: SyncOwnerLease;
  readonly hold: Promise<void>;
} {
  let released = false;
  let releaseHold: (() => void) | null = null;
  const hold = new Promise<void>((release) => {
    releaseHold = release;
  });
  return {
    hold,
    lease: {
      isOwner: true,
      release: () => {
        if (released) return;
        released = true;
        releaseHold?.();
      },
    },
  };
}

/**
 * Try to become the sync owner for `dbName`. Followers get `isOwner: false`;
 * Web Locks auto-release on tab death so a follower can retry later. A
 * browser that refuses the lock (a sandboxed frame, a storage policy) cannot
 * coordinate tabs, so that tab owns alone: it never fails to boot over this.
 */
export async function tryAcquireSyncOwnerLease(
  dbName: string
): Promise<SyncOwnerLease> {
  const locks = readLockManager();
  if (locks === null) return OWNER_WITHOUT_LOCK;

  return new Promise<SyncOwnerLease>((resolve) => {
    const ownAlone = (): void => resolve(OWNER_WITHOUT_LOCK);
    const onLock = (lock: unknown): Promise<void> | undefined => {
      if (lock === null) {
        resolve({ isOwner: false, release: () => undefined });
        return undefined;
      }
      const held = heldLease();
      resolve(held.lease);
      return held.hold;
    };
    try {
      locks
        .request(
          syncOwnerLockName(dbName),
          { mode: 'exclusive', ifAvailable: true },
          onLock
        )
        .catch(ownAlone);
    } catch {
      ownAlone();
    }
  });
}
