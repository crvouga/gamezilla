import * as SQLite from 'expo-sqlite';

/** Best-effort cleanup of a leftover `${databaseName}.db` from prior local SDKs. */
export async function deleteLegacySidecarDb(
  databaseName: string
): Promise<void> {
  try {
    await SQLite.deleteDatabaseAsync(`${databaseName}.db`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('not found')) {
      console.warn(`Legacy sidecar database cleanup skipped: ${message}`);
    }
  }
}
