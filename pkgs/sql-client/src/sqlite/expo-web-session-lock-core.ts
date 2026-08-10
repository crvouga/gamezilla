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
        // #region agent log
        fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9554b'},body:JSON.stringify({sessionId:'c9554b',runId:'pre-fix',hypothesisId:'A',location:'expo-web-session-lock-core.ts:request',message:'locks.request callback',data:{lockIsNull:lock===null,lockName:EXPO_SQLITE_WEB_LOCK},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (lock === null) {
          reject(new ExpoSqliteWebSessionLockError());
          return;
        }
        resolve();
        return new Promise<void>((release) => {
          // #region agent log
          fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9554b'},body:JSON.stringify({sessionId:'c9554b',runId:'pre-fix',hypothesisId:'E',location:'expo-web-session-lock-core.ts:held',message:'lock held until pagehide',data:{lockName:EXPO_SQLITE_WEB_LOCK},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          onPageHide(() => {
            // #region agent log
            fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9554b'},body:JSON.stringify({sessionId:'c9554b',runId:'pre-fix',hypothesisId:'E',location:'expo-web-session-lock-core.ts:release',message:'pagehide released lock',data:{lockName:EXPO_SQLITE_WEB_LOCK},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            release();
          });
        });
      }
    );
  });
}

export function tryAcquireExpoSqliteWebSessionLockWith(
  deps: SessionLockDeps
): Promise<void> {
  if (deps.platformOs !== 'web' || deps.locks === undefined) {
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9554b'},body:JSON.stringify({sessionId:'c9554b',runId:'pre-fix',hypothesisId:'C',location:'expo-web-session-lock-core.ts:skip',message:'lock skipped non-web or no locks',data:{platformOs:deps.platformOs,hasLocks:deps.locks!==undefined},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return Promise.resolve();
  }
  return requestExpoSqliteWebSessionLock(deps.locks, deps.onPageHide);
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
