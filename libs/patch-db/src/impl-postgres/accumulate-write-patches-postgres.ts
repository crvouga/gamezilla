import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type { Patch, PatchInput } from '../interface';
import {
  getPatchTopLevelFromAttributes,
  normalizePatchAttributesForStorage,
} from '../interface';

export type PatchInsertBatchRow = {
  patch_id: string;
  entity_id: string;
  entity_type: string;
  attributes: Record<string, unknown>;
  created_at: string;
  recorded_at: string;
  parent_id: string | null;
};

export type AccumulateWritePostgresDeps = {
  resolveParentId: (
    tx: SqlClient,
    entityId: string,
    entityType: string
  ) => Promise<string | null>;
  bumpWriteTimestamps: (
    patch: PatchInput,
    lastTimestamp: number
  ) => { now: string; recordedAt: string; lastTimestamp: number };
};

type ResolveWriteParentArgs = {
  tx: SqlClient;
  patch: PatchInput;
  parentCache: Map<string, string | null>;
  patchIdsInBatch: ReadonlySet<string>;
  existingParentPatchIds: ReadonlySet<string>;
};

async function resolveWriteParentId(
  deps: Pick<AccumulateWritePostgresDeps, 'resolveParentId'>,
  args: ResolveWriteParentArgs
): Promise<string | null> {
  const { tx, patch, parentCache, patchIdsInBatch, existingParentPatchIds } =
    args;
  const isSyncedPatch =
    'patchId' in patch &&
    'parentId' in patch &&
    typeof patch.patchId === 'string';
  if (isSyncedPatch) {
    const clientParent =
      typeof patch.parentId === 'string' ? patch.parentId : null;
    if (clientParent === null) {
      return null;
    }
    if (patchIdsInBatch.has(clientParent)) {
      return clientParent;
    }
    if (existingParentPatchIds.has(clientParent)) {
      return clientParent;
    }
    const key = `${patch.entityId}\0${patch.entityType}`;
    if (!parentCache.has(key)) {
      parentCache.set(
        key,
        await deps.resolveParentId(tx, patch.entityId, patch.entityType)
      );
    }
    return parentCache.get(key)!;
  }
  const key = `${patch.entityId}\0${patch.entityType}`;
  return parentCache.get(key)!;
}

async function prefetchParentIdsForEntities(
  deps: Pick<AccumulateWritePostgresDeps, 'resolveParentId'>,
  tx: SqlClient,
  sorted: readonly PatchInput[],
  parentCache: Map<string, string | null>
): Promise<void> {
  const uniqueKeys = new Map<string, { entityId: string; entityType: string }>();
  for (const patch of sorted) {
    const key = `${patch.entityId}\0${patch.entityType}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.set(key, {
        entityId: patch.entityId,
        entityType: patch.entityType,
      });
    }
  }
  await Promise.all(
    [...uniqueKeys.values()].map(async ({ entityId, entityType }) => {
      const key = `${entityId}\0${entityType}`;
      if (!parentCache.has(key)) {
        parentCache.set(
          key,
          await deps.resolveParentId(tx, entityId, entityType)
        );
      }
    })
  );
}

async function collectExistingParentPatchIds(
  tx: SqlClient,
  sorted: readonly PatchInput[],
  patchIdsInBatch: ReadonlySet<string>
): Promise<Set<string>> {
  const toCheck = new Set<string>();
  for (const patch of sorted) {
    const isSyncedPatch =
      'patchId' in patch &&
      'parentId' in patch &&
      typeof patch.patchId === 'string';
    if (!isSyncedPatch) continue;
    const clientParent =
      typeof patch.parentId === 'string' ? patch.parentId : null;
    if (clientParent !== null && !patchIdsInBatch.has(clientParent)) {
      toCheck.add(clientParent);
    }
  }
  if (toCheck.size === 0) return new Set();
  const ids = [...toCheck];
  const ph = ids.map(() => '?').join(', ');
  const rows = await tx.query<{ patch_id: string }>(
    `SELECT patch_id FROM patches WHERE patch_id IN (${ph})`,
    ids
  );
  return new Set(rows.map((r) => r.patch_id));
}

export async function accumulateWritePatchesPostgres(
  deps: AccumulateWritePostgresDeps,
  tx: SqlClient,
  sorted: PatchInput[]
): Promise<{
  writtenPatches: Patch[];
  batchRows: PatchInsertBatchRow[];
  touchedEntities: Set<string>;
}> {
  const writtenPatches: Patch[] = [];
  const batchRows: PatchInsertBatchRow[] = [];
  const touchedEntities = new Set<string>();
  const parentCache = new Map<string, string | null>();
  const patchIdsInBatch = new Set<string>();
  for (const p of sorted) {
    if ('patchId' in p && typeof p.patchId === 'string') {
      patchIdsInBatch.add(p.patchId);
    }
  }
  const existingParentPatchIds = await collectExistingParentPatchIds(
    tx,
    sorted,
    patchIdsInBatch
  );
  await prefetchParentIdsForEntities(deps, tx, sorted, parentCache);
  let lastTimestamp = Date.now() - 1;
  for (const patch of sorted) {
    const entityKey = `${patch.entityId}\0${patch.entityType}`;
    const parentId = await resolveWriteParentId(deps, {
      tx,
      patch,
      parentCache,
      patchIdsInBatch,
      existingParentPatchIds,
    });
    const ts = deps.bumpWriteTimestamps(patch, lastTimestamp);
    lastTimestamp = ts.lastTimestamp;
    const storedAttributes = normalizePatchAttributesForStorage(patch);
    const { createdBy, sessionId } =
      getPatchTopLevelFromAttributes(storedAttributes);
    const patchId =
      'patchId' in patch && typeof patch.patchId === 'string'
        ? patch.patchId
        : crypto.randomUUID();
    writtenPatches.push({
      ...patch,
      patchId,
      parentId,
      createdAt: ts.now,
      recordedAt: ts.recordedAt,
      createdBy,
      sessionId,
    });
    batchRows.push({
      patch_id: patchId,
      entity_id: patch.entityId,
      entity_type: patch.entityType,
      attributes: storedAttributes,
      created_at: ts.now,
      recorded_at: ts.recordedAt,
      parent_id: parentId,
    });
    touchedEntities.add(entityKey);
  }
  return { writtenPatches, batchRows, touchedEntities };
}
