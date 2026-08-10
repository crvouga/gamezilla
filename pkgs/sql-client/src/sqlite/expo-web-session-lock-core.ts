const EXPO_SQLITE_WEB_LOCK = 'gamezilla-expo-sqlite';

/** How long a soft-reload may wait for the previous document to release the lock. */
const LOCK_WAIT_MS = 2_500;

/** Thrown when another tab already holds the expo-sqlite OPFS session lock. */
export class ExpoSqliteWebSessionLockError extends Error {
  constructor() {
    super(
      'Another tab of this site is already using the local database. ' +
        'Close other Gamezilla tabs and reload, or reset local data to continue here.'
    );
    this.name = 'ExpoSqliteWebSessionLockError';
  }
}

export function isExpoSqliteWebSessionLockError(
  error: unknown
): error is ExpoSqliteWebSessionLockError {
  return error instanceof ExpoSqliteWebSessionLockError;
}

export type SessionLockDeps = {
  platformOs: string;
  locks: Pick<LockManager, 'request'> | undefined;
  onPageHide: (release: () => void) => void;
  /** Override wait budget when `ifAvailable` misses (tests). */
  lockWaitMs?: number;
};

/** Same-realm memo so identity switches / retries do not re-request the lock. */
let heldAcquire: Promise<void> | null = null;

/** Test-only: clear the in-realm held acquire memo. */
export function resetExpoSqliteWebSessionLockForTests(): void {
  heldAcquire = null;
}

function holdUntilPageHide(
  lock: Lock | null,
  onPageHide: SessionLockDeps['onPageHide'],
  resolve: () => void,
  reject: (error: unknown) => void
): Promise<void> | undefined {
  if (lock === null) {
    reject(new ExpoSqliteWebSessionLockError());
    return;
  }
  resolve();
  return new Promise<void>((release) => {
    onPageHide(() => {
      // Drop memo so a restored document cannot skip Web Locks after release.
      heldAcquire = null;
      release();
    });
  });
}

function requestIfAvailable(
  locks: Pick<LockManager, 'request'>,
  onPageHide: SessionLockDeps['onPageHide']
): Promise<'acquired' | 'busy'> {
  return new Promise((resolve, reject) => {
    void locks.request(
      EXPO_SQLITE_WEB_LOCK,
      { mode: 'exclusive', ifAvailable: true },
      (lock) => {
        if (lock === null) {
          resolve('busy');
          return;
        }
        return holdUntilPageHide(
          lock,
          onPageHide,
          () => resolve('acquired'),
          reject
        );
      }
    );
  });
}

function requestWaiting(
  locks: Pick<LockManager, 'request'>,
  onPageHide: SessionLockDeps['onPageHide'],
  lockWaitMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const signal = AbortSignal.timeout(lockWaitMs);
    void locks
      .request(EXPO_SQLITE_WEB_LOCK, { mode: 'exclusive', signal }, (lock) =>
        holdUntilPageHide(lock, onPageHide, resolve, reject)
      )
      .catch(() => {
        reject(new ExpoSqliteWebSessionLockError());
      });
  });
}

async function requestExpoSqliteWebSessionLock(
  locks: Pick<LockManager, 'request'>,
  onPageHide: SessionLockDeps['onPageHide'],
  lockWaitMs: number
): Promise<void> {
  const first = await requestIfAvailable(locks, onPageHide);
  if (first === 'acquired') return;
  await requestWaiting(locks, onPageHide, lockWaitMs);
}

export function tryAcquireExpoSqliteWebSessionLockWith(
  deps: SessionLockDeps
): Promise<void> {
  if (deps.platformOs !== 'web' || deps.locks === undefined) {
    return Promise.resolve();
  }
  if (heldAcquire !== null) {
    return heldAcquire;
  }
  const lockWaitMs = deps.lockWaitMs ?? LOCK_WAIT_MS;
  heldAcquire = requestExpoSqliteWebSessionLock(
    deps.locks,
    deps.onPageHide,
    lockWaitMs
  ).catch((error: unknown) => {
    heldAcquire = null;
    throw error;
  });
  return heldAcquire;
}

export function defaultExpoSqliteWebSessionOnPageHide(
  release: () => void
): void {
  if (typeof window === 'undefined') {
    release();
    return;
  }
  window.addEventListener('pagehide', () => release(), { once: true });
}
