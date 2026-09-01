import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

/**
 * Best-effort cleanup of a leftover `${databaseName}.db` from prior local SDKs.
 * Skipped on web: `deleteDatabaseAsync` can hang forever when AccessHandlePoolVFS
 * is wedged; web recovery clears OPFS via in-process wipe + reload instead.
 */
export async function deleteLegacySidecarDb(
  databaseName: string
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    await SQLite.deleteDatabaseAsync(`${databaseName}.db`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('not found')) {
      console.warn(`Legacy sidecar database cleanup skipped: ${message}`);
    }
  }
}
