import { Platform } from 'react-native';

/**
 * expo-sqlite on web stores files under an `expo-sqlite` directory in the origin
 * private file system (see `AccessHandlePoolVFS` in expo-sqlite). Corruption or
 * incompatible headers there can make `sqlite3_open_v2` fail even after
 * `deleteDatabaseAsync` — removing the directory forces the next load to recreate
 * the pool. Safe to call when the DB is already broken / deleted.
 */
export async function clearExpoSqliteWebOpfsBestEffort(): Promise<void> {
  if (Platform.OS !== 'web') {
    return;
  }
  if (typeof navigator === 'undefined' || navigator.storage?.getDirectory === undefined) {
    return;
  }
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry('expo-sqlite', { recursive: true });
  } catch {
    // Directory missing, API unsupported, or permission denied
  }
}
