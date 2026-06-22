import { Platform } from 'react-native';

import {
  defaultExpoSqliteWebSessionOnPageHide,
  tryAcquireExpoSqliteWebSessionLockWith,
} from './expo-sqlite-web-session-lock-core';

export {
  ExpoSqliteWebSessionLockError,
  isExpoSqliteWebSessionLockError,
} from './expo-sqlite-web-session-lock-core';

/**
 * On web, expo-sqlite shares one OPFS-backed worker per origin. Only one tab
 * may hold an open database session at a time; concurrent opens corrupt the VFS
 * or hang until recovery exhausts. Acquire an exclusive session lock before
 * opening SQLite and keep it until the tab unloads.
 */
export function tryAcquireExpoSqliteWebSessionLock(): Promise<void> {
  return tryAcquireExpoSqliteWebSessionLockWith({
    platformOs: Platform.OS,
    locks: typeof navigator === 'undefined' ? undefined : navigator.locks,
    onPageHide: defaultExpoSqliteWebSessionOnPageHide,
  });
}
