import { assert } from '@gamezilla/lib/assert';
import type { PatchDb, PatchDbQuery, PatchDbResult } from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import type { ActiveQuery } from './active-query-registry';

export async function buildSyncQueriesForPoll(
  local: PatchDb,
  entries: ActiveQuery[]
): Promise<PatchDbQuery[]> {
  const syncQueries: PatchDbQuery[] = [];
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
  local: PatchDb,
  results: PatchDbResult[]
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

export function toWireQueriesFromSyncQueries(
  syncQueries: PatchDbQuery[]
): PatchDbQuery[] {
  return syncQueries.map(({ knownPatches, ...rest }) => ({
    ...rest,
    knownPatchIds: knownPatches?.map((p) => p.patchId) ?? [],
  }));
}
