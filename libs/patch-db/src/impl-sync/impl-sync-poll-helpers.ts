import { assert } from '@gamezilla/lib/assert';
import type { Patch, PatchDb, PatchDbQuery, PatchDbResult } from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import type { ActiveQuery } from './active-query-registry';

function isPatchMarkedSyncedLocally(syncedAt: unknown): boolean {
  return (
    syncedAt !== null &&
    syncedAt !== undefined &&
    syncedAt !== false &&
    syncedAt !== ''
  );
}

function groupPatchesByEntityId(
  patches: readonly Patch[]
): Map<string, Patch[]> {
  const byEntity = new Map<string, Patch[]>();
  for (const p of patches) {
    const list = byEntity.get(p.entityId) ?? [];
    list.push(p);
    byEntity.set(p.entityId, list);
  }
  return byEntity;
}

function serverPatchIdsByEntity(
  serverPatches: readonly Patch[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const p of serverPatches) {
    let set = map.get(p.entityId);
    if (set === undefined) {
      set = new Set();
      map.set(p.entityId, set);
    }
    set.add(p.patchId);
  }
  return map;
}

function addSyncedMissingWhenServerEmptyForEntity(
  locals: readonly Patch[],
  serverPatchIds: ReadonlySet<string>,
  patchIdsToUnsync: Set<string>
): void {
  if (serverPatchIds.size > 0) return;
  for (const localPatch of locals) {
    const syncedAt = localPatch.attributes['patch/syncedAt'];
    if (
      isPatchMarkedSyncedLocally(syncedAt) &&
      !serverPatchIds.has(localPatch.patchId)
    ) {
      patchIdsToUnsync.add(localPatch.patchId);
    }
  }
}

/**
 * Per-entity: if the server returned **no** patches for that entity, treat it like
 * catastrophic loss for that entity and unsync every locally-synced row (so push
 * re-sends). If the server returned **any** patch for that entity, missing local
 * ids are assumed to be compaction/replacement — do not clear `patch/syncedAt`
 * (avoids infinite re-push for one entity).
 *
 * Tracked poll queries often batch many `entityId`s in one read; a non-empty
 * combined `result.patches` must not mask another entity that truly has zero
 * server patches.
 */
function collectMissingSyncedIdsPerEntity(
  knownPatches: readonly Patch[],
  serverPatches: readonly Patch[],
  patchIdsToUnsync: Set<string>
): void {
  const knownByEntity = groupPatchesByEntityId(knownPatches);
  const serverIdsByEntity = serverPatchIdsByEntity(serverPatches);
  for (const [, locals] of knownByEntity) {
    const entityId = locals[0]?.entityId;
    if (entityId === undefined) continue;
    const serverPatchIds = serverIdsByEntity.get(entityId) ?? new Set();
    addSyncedMissingWhenServerEmptyForEntity(
      locals,
      serverPatchIds,
      patchIdsToUnsync
    );
  }
}

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

/**
 * Detects **catastrophic** server data loss per entity by comparing the server's
 * response against locally synced patches. For each query without a `where` clause
 * (entity-tracking queries), if the server returns **zero** patches for an
 * entity the client still tracks, that entity's synced rows are marked unsynced
 * so the next push re-sends them.
 *
 * When the server returns at least one patch **for that same entity**, missing
 * local ids are not unsynced (compaction / id replacement).
 */
export async function markMissingSyncedPatchesOnLocal(
  local: PatchDb,
  queries: PatchDbQuery[],
  results: PatchDbResult[]
): Promise<boolean> {
  const patchIdsToUnsync = new Set<string>();

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const result = results[i];
    if (!query?.knownPatches || !result) continue;
    if (query.where) continue;

    collectMissingSyncedIdsPerEntity(
      query.knownPatches,
      result.patches,
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
  syncQueries: PatchDbQuery[]
): PatchDbQuery[] {
  return syncQueries.map(({ knownPatches, ...rest }) => ({
    ...rest,
    knownPatchIds: knownPatches?.map((p) => p.patchId) ?? [],
  }));
}
