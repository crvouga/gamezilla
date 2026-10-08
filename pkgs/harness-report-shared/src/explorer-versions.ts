import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { isCommitSha } from './keys';

/** A per-version marker lets an independent producer appear without a spec run. */
export async function recordExplorerVersion(
  store: ObjectStore,
  sha: string
): Promise<void> {
  if (!isCommitSha(sha)) throw new Error('Invalid commit');
  await writeUtf8(
    store,
    `versions/${sha}.json`,
    JSON.stringify({ sha }),
    'application/json'
  );
}

export async function listExplorerVersions(
  store: ObjectStore
): Promise<readonly string[]> {
  const versions: string[] = [];
  for (const key of await store.listKeys('versions/')) {
    const sha = /^versions\/([0-9a-f]{40})\.json$/.exec(key)?.[1];
    if (sha === undefined) continue;
    const body = await readUtf8(store, key);
    if (body === null || (JSON.parse(body) as { sha?: unknown }).sha !== sha)
      throw new Error('Invalid explorer version');
    versions.push(sha);
  }
  return versions;
}
