import { assertDatabaseName } from '@pkgs/sql-root-shared-ts/assert-database-name';
import { OPFS_SAH_POOL_ROOT } from './opfs-sah-pool-backend';

type AccessHandle = { close(): void };
type SyncFile = FileSystemFileHandle & {
  createSyncAccessHandle(): Promise<AccessHandle>;
};

async function collectHandles(
  directory: FileSystemDirectoryHandle,
  handles: AccessHandle[]
): Promise<void> {
  for await (const entry of directory.values()) {
    if (entry.kind === 'directory')
      await collectHandles(
        await directory.getDirectoryHandle(entry.name),
        handles
      );
    else {
      const file = (await directory.getFileHandle(entry.name)) as SyncFile;
      handles.push(await file.createSyncAccessHandle());
    }
  }
}

/**
 * The broker already owns this database. Detect a discarded worker's lingering
 * handles without invoking SQLite's initializer, whose failure cleanup removes
 * the pool directory. Probing never changes file bytes or associations.
 */
export async function assertOpfsPoolUnlocked(
  dbName: string,
  root: FileSystemDirectoryHandle
): Promise<void> {
  assertDatabaseName(dbName);
  let directory: FileSystemDirectoryHandle;
  try {
    directory = await (
      await root.getDirectoryHandle(OPFS_SAH_POOL_ROOT.slice(1))
    ).getDirectoryHandle(dbName);
  } catch (error) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'NotFoundError'
    )
      return;
    throw error;
  }
  const handles: AccessHandle[] = [];
  try {
    await collectHandles(directory, handles);
  } finally {
    for (const handle of handles) handle.close();
  }
}
