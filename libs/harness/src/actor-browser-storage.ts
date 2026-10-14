// @io-wall-ok
/** Browser devices retain cookies and local SQLite across application restarts. */
export type ActorBrowserStorage = {
  readonly dataStore: { readonly directory: string };
  readonly cleanup: () => Promise<void>;
};

export async function createActorBrowserStorage(
  id: string
): Promise<ActorBrowserStorage> {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), `harness-webview-${id}-`));
  return {
    dataStore: { directory },
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

const DEVICE_FILES = /file ?system/i;

/**
 * Overwrite every file the browser keeps for the page's private file system
 * (where the app's SQLite lives) with noise, keeping names and sizes, as a
 * damaged disk would. Call only while the app is closed. Throws when there is
 * nothing to damage: a damage that touched nothing proves nothing.
 */
export async function damageActorBrowserStorage(
  storage: ActorBrowserStorage
): Promise<void> {
  const { readdir, stat, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  let damaged = 0;
  const walk = async (directory: string, inside: boolean): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const within = inside || DEVICE_FILES.test(entry.name);
      if (entry.isDirectory()) {
        await walk(path, within);
      } else if (within && entry.isFile()) {
        const size = Math.max((await stat(path)).size, 4096);
        await writeFile(path, new Uint8Array(size).fill(0xa5));
        damaged += 1;
      }
    }
  };
  await walk(storage.dataStore.directory, false);
  if (damaged === 0) {
    throw new Error(
      `no stored files to damage under ${storage.dataStore.directory}`
    );
  }
}
