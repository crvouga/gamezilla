import type { JSX, ParentProps } from 'solid-js';

/**
 * Marker provider kept for composition stability. Identity transitions remount
 * {@link SyncEngineBoot}. No longer registers a clearLocalData flush
 * (per-account SQLite files isolate data).
 */
export function AuthSyncBridge(props: ParentProps): JSX.Element {
  return props.children;
}
