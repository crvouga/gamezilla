import type { PatchDb, PatchDbQuery, PatchDbResult } from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';

export { buildSyncQueriesForPoll } from './build-sync-queries-for-poll';

export async function mergeRemotePatchesIntoLocal(
  local: PatchDb,
  results: PatchDbResult[]
): Promise<boolean> {
  let hasNewPatches = false;
  for (const remoteResult of results) {
    if (remoteResult.patches.length > 0) {
      const withSynced = remoteResult.patches.map((p) => ({
        ...p,
        attributes: { ...p.attributes, 'patch/synced-at': '1' },
      }));
      await local.write(withSynced, OPEN_PATCHES_DB_CONTEXT);
      hasNewPatches = true;
    }
  }
  return hasNewPatches;
}

export function toWireQueriesFromSyncQueries(
  syncQueries: PatchDbQuery[]
): PatchDbQuery[] {
  return syncQueries.map(({ knownPatches, ...rest }) => ({
    ...rest,
    knownPatchIds: knownPatches?.map((p) => p.patchId) ?? [],
  }));
}
