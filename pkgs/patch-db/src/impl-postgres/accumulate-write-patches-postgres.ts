import type { SqlClient } from '@pkgs/sql-client/interface';
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
  /**
   * Optional batched form of {@link resolveParentId}. When provided, the
   * accumulator uses it to resolve all entity parent ids in a single
   * round-trip instead of issuing one request per entity in parallel.
   * Implementations should return only entries with a non-null leaf
   * patch id; missing entries are treated as `null` by the caller.
   */
  resolveParentIdsBatch?: (
    tx: SqlClient,
    entities: readonly { entityId: string; entityType: string }[]
  ) => Promise<Map<string, string | null>>;
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
  deps: Pick<
    AccumulateWritePostgresDeps,
    'resolveParentId' | 'resolveParentIdsBatch'
  >,
  tx: SqlClient,
  sorted: readonly PatchInput[],
  parentCache: Map<string, string | null>
): Promise<void> {
  const uniqueKeys = new Map<
    string,
    { entityId: string; entityType: string }
  >();
  for (const patch of sorted) {
    const key = `${patch.entityId}\0${patch.entityType}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.set(key, {
        entityId: patch.entityId,
        entityType: patch.entityType,
      });
    }
  }
  const pending = [...uniqueKeys.entries()].filter(
    ([key]) => !parentCache.has(key)
  );
  if (pending.length === 0) return;
  // Prefer the batched form: a single SQL round-trip for every touched
  // entity. The legacy per-entity `Promise.all` path saturated serverless
  // HTTP gateways (e.g. Neon) on large write batches and produced
  // `ECONNRESET` once the concurrent fan-out exceeded the connection
  // budget. The batched query is functionally equivalent: missing rows
  // mean the entity has no patches yet, which we record as `null`.
  if (deps.resolveParentIdsBatch !== undefined) {
    const resolved = await deps.resolveParentIdsBatch(
      tx,
      pending.map(([, v]) => v)
    );
    for (const [key, value] of pending) {
      const found = resolved.get(`${value.entityId}\0${value.entityType}`);
      parentCache.set(key, found ?? null);
    }
    return;
  }
  await Promise.all(
    pending.map(async ([key, { entityId, entityType }]) => {
      parentCache.set(
        key,
        await deps.resolveParentId(tx, entityId, entityType)
      );
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
