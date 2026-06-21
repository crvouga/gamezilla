const EXPO_SQLITE_WEB_LOCK = 'gamezilla-expo-sqlite';

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
};

function requestExpoSqliteWebSessionLock(
  locks: Pick<LockManager, 'request'>,
  onPageHide: SessionLockDeps['onPageHide']
): Promise<void> {
  return new Promise((resolve, reject) => {
    void locks.request(
      EXPO_SQLITE_WEB_LOCK,
      { mode: 'exclusive', ifAvailable: true },
      (lock) => {
        if (lock === null) {
          reject(new ExpoSqliteWebSessionLockError());
          return;
        }
        resolve();
        return new Promise<void>((release) => {
          onPageHide(release);
        });
      }
    );
  });
}

export function tryAcquireExpoSqliteWebSessionLockWith(
  deps: SessionLockDeps
): Promise<void> {
  if (deps.platformOs !== 'web' || deps.locks === undefined) {
    return Promise.resolve();
  }
  return requestExpoSqliteWebSessionLock(deps.locks, deps.onPageHide);
}

export function defaultExpoSqliteWebSessionOnPageHide(release: () => void): void {
  if (typeof window === 'undefined') {
    release();
    return;
  }
  window.addEventListener('pagehide', () => release(), { once: true });
}
