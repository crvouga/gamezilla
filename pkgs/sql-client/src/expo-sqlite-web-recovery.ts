import { Platform } from 'react-native';

import {
  EXPO_SQLITE_WEB_FATAL_EVENT,
  matchesRecoverableExpoSqliteWebErrorMessage,
} from './expo-sqlite-web-recovery-core';

export {
  EXPO_SQLITE_WEB_FATAL_EVENT,
  matchesRecoverableExpoSqliteWebErrorMessage,
} from './expo-sqlite-web-recovery-core';

/** True for OPFS / worker failures where wiping local SQLite is the safe fix. */
export function isRecoverableExpoSqliteWebRuntimeError(
  error: unknown
): boolean {
  if (Platform.OS !== 'web') return false;
  return matchesRecoverableExpoSqliteWebErrorMessage(error);
}

export function publishExpoSqliteWebFatalError(error: Error): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(
    new CustomEvent<Error>(EXPO_SQLITE_WEB_FATAL_EVENT, { detail: error })
  );
}

export function subscribeExpoSqliteWebFatalError(
  listener: (error: Error) => void
): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};
  if (typeof window.addEventListener !== 'function') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<Error>).detail;
    if (detail instanceof Error) {
      listener(detail);
    }
  };
  window.addEventListener(EXPO_SQLITE_WEB_FATAL_EVENT, handler);
  return () => window.removeEventListener(EXPO_SQLITE_WEB_FATAL_EVENT, handler);
}
