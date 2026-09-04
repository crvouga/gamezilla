export type ClearExpoSqliteWebOpfsResult =
  | { readonly ok: true; readonly skipped: boolean }
  | { readonly ok: false; readonly error: unknown };

/**
 * expo-sqlite on web stores files under an `expo-sqlite` directory in the origin
 * private file system (see `AccessHandlePoolVFS` in expo-sqlite). Corruption or
 * incompatible headers there can make `sqlite3_open_v2` fail even after
 * `deleteDatabaseAsync` — removing the directory forces the next load to recreate
 * the pool. Safe to call when the DB is already broken / deleted.
 *
 * Returns an explicit success/failure so callers can avoid setting a "we already
 * recovered" flag when the wipe silently failed (e.g. `NoModificationAllowedError`
 * because another tab/worker still holds a `FileSystemSyncAccessHandle`).
 *
 * The OPFS feature check doubles as the platform check, so this module stays
 * free of `react-native` and remains importable from Bun / worker contexts.
 */
export async function clearExpoSqliteWebOpfsBestEffort(): Promise<ClearExpoSqliteWebOpfsResult> {
  if (
    typeof navigator === 'undefined' ||
    navigator.storage?.getDirectory === undefined
  ) {
    return { ok: true, skipped: true };
  }
  try {
    const root = await navigator.storage.getDirectory();
    try {
      const dir = await root.getDirectoryHandle('expo-sqlite');
      // Prefer deleting children first — recursive removeEntry often fails while
      // any AccessHandlePoolVFS sync handle is still open.
      for await (const entry of dir.values()) {
        try {
          await dir.removeEntry(entry.name, { recursive: true });
        } catch {
          // Child may still be locked; parent remove will report failure.
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return { ok: true, skipped: true };
      }
    }
    try {
      await root.removeEntry('expo-sqlite', { recursive: true });
      return { ok: true, skipped: false };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return { ok: true, skipped: true };
      }
      return { ok: false, error };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return { ok: true, skipped: true };
    }
    return { ok: false, error };
  }
}
