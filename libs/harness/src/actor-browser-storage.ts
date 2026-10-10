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
