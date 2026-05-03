import { assert } from '@gamezilla/lib/assert';
import type {
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
} from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import type { ActiveQuery } from './active-query-registry';

function collectMissingSyncedIds(
  knownPatches: readonly Patch[],
  serverPatchIds: ReadonlySet<string>,
  patchIdsToUnsync: Set<string>
): void {
  for (const localPatch of knownPatches) {
    const syncedAt = localPatch.attributes['patch/syncedAt'];
    const isSynced = syncedAt !== null && syncedAt !== undefined;
    if (isSynced && !serverPatchIds.has(localPatch.patchId)) {
      patchIdsToUnsync.add(localPatch.patchId);
    }
  }
}

export async function buildSyncQueriesForPoll(
  local: PatchesDb,
  entries: ActiveQuery[]
): Promise<PatchesDbQuery[]> {
  const syncQueries: PatchesDbQuery[] = [];
  for (const { query } of entries) {
    const { limit: _limit, offset: _offset, ...queryWithoutPagination } = query;
    const [localResult] = await local.read(
      [queryWithoutPagination],
      OPEN_PATCHES_DB_CONTEXT
    );
    assert.ok(
      localResult !== null && localResult !== undefined,
      'read([query]) must return one result'
    );
    syncQueries.push({
      ...queryWithoutPagination,
      knownPatches: localResult.patches,
    });

    if (
      query.where !== null &&
      query.where !== undefined &&
      query.entityType !== null &&
      query.entityType !== undefined
    ) {
      const entityIds = [
        ...new Set(localResult.patches.map((p) => p.entityId)),
      ];
      if (entityIds.length > 0) {
        const [trackedResult] = await local.read(
          [{ entityType: query.entityType, entityId: entityIds }],
          OPEN_PATCHES_DB_CONTEXT
        );
        assert.ok(
          trackedResult !== null && trackedResult !== undefined,
          'read([query]) must return one result'
        );
        syncQueries.push({
          entityType: query.entityType,
          entityId: entityIds,
          knownPatches: trackedResult.patches,
        });
      }
    }
  }
  return syncQueries;
}

export async function mergeRemotePatchesIntoLocal(
  local: PatchesDb,
  results: PatchesDbResult[]
): Promise<boolean> {
  let hasNewPatches = false;
  for (const remoteResult of results) {
    if (remoteResult.patches.length > 0) {
      const withSynced = remoteResult.patches.map((p) => ({
        ...p,
        attributes: { ...p.attributes, 'patch/syncedAt': '1' },
      }));
      await local.write(withSynced, OPEN_PATCHES_DB_CONTEXT);
      hasNewPatches = true;
    }
  }
  return hasNewPatches;
}

/**
 * Detects server data loss by comparing the server's response against locally
 * synced patches. For each query without a `where` clause (entity-tracking
 * queries), if the server is missing patches the client had already pushed,
 * those patches are marked unsynced so the next push cycle re-sends them.
 */
export async function markMissingSyncedPatchesOnLocal(
  local: PatchesDb,
  queries: PatchesDbQuery[],
  results: PatchesDbResult[]
): Promise<boolean> {
  const patchIdsToUnsync = new Set<string>();

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const result = results[i];
    if (!query?.knownPatches || !result) continue;
    if (query.where) continue;

    const serverPatchIds = new Set(result.patches.map((p) => p.patchId));
    collectMissingSyncedIds(
      query.knownPatches,
      serverPatchIds,
      patchIdsToUnsync
    );
  }

  if (patchIdsToUnsync.size === 0) return false;

  await local.update(
    [...patchIdsToUnsync].map((patchId) => ({
      patchId,
      attributes: { 'patch/syncedAt': null },
    })),
    OPEN_PATCHES_DB_CONTEXT
  );
  return true;
}

export function toWireQueriesFromSyncQueries(
  syncQueries: PatchesDbQuery[]
): PatchesDbQuery[] {
  return syncQueries.map(({ knownPatches, ...rest }) => ({
    ...rest,
    knownPatchIds: knownPatches?.map((p) => p.patchId) ?? [],
  }));
}
