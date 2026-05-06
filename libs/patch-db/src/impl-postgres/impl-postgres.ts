import { assert } from '@gamezilla/lib/assert';
import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { assertWhereFragment } from '@gamezilla/lib/sqlite';
import { PatchDbHookRegistry } from '../hook-registry';
import type { PatchRow } from '../impl-sqlite/types';
import type {
  Attribute,
  Patch,
  PatchDb,
  PatchDbCompaction,
  PatchDbContext,
  PatchDbEngineOptions,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  PatchRejectionReason,
  WritePatchesResult,
} from '../interface';
import {
  assertAttribute,
  assertEntityKey,
  assertPatchId,
  getPatchTopLevelFromAttributes,
  normalizePatchAttributesForStorage,
  OPEN_PATCHES_DB_CONTEXT,
  PATCH_META_KEYS,
} from '../interface';
import { patchRowIsSyncRejected } from '../patch-row-sync-rejected';
import { PATCH_CREATED_BY_ID } from '../metadata/patch-metadata';
import { DEFAULT_PATCH_DB_COMPACTION_POLICY } from '../policy/compaction-policy';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '../policy/system-device';
import { finishCompactionAfterInsert } from '../compact-entity-tx-helpers';
import { topologicalSortPatches } from '../topological-sort';
import { migratePatchDbPostgres } from './migrate';
import { readPatches } from './read-ops';
import {
  mergePatchRowsIntoSnapshotAttrs,
  recomputeSnapshotSingle,
  recomputeTouchedSnapshots,
  toPatchRow,
} from './snapshot-ops';
import {
  INSERT_PATCH,
  INSERT_PATCHES_BATCH,
  RESOLVE_PARENT_ID,
  SELECT_PATCHES_FOR_SNAPSHOT,
} from './sql-constants';

type PatchInsertBatchRow = {
  patch_id: string;
  entity_id: string;
  entity_type: string;
  attributes: Record<string, unknown>;
  created_at: string;
  recorded_at: string;
  parent_id: string | null;
};

export class PatchDbImplPostgres implements PatchDb {
  readonly hooks = new PatchDbHookRegistry();

  readonly compaction: PatchDbCompaction = {
    compactEntity: (key, options, ctx) => this.compactEntity(key, options, ctx),
    compactAll: (options, ctx) => this.compactAll(options, ctx),
  };

  constructor(
    private readonly sqlClient: SqlClient,
    private readonly opts: PatchDbEngineOptions = {}
  ) {}

  /** Idempotent Postgres DDL for patches + snapshots (no instance required). */
  static async migrateUp(args: {
    sqlClient: SqlClient;
    logger: Logger;
  }): Promise<void> {
    await migratePatchDbPostgres(args);
  }

  private async resolveParentId(
    tx: SqlClient,
    entityId: string,
    entityType: string
  ): Promise<string | null> {
    const rows = await tx.query<{ patch_id: string }>(RESOLVE_PARENT_ID, [
      entityId,
      entityType,
      entityId,
      entityType,
      entityId,
      entityType,
    ]);
    const first = rows[0];
    return first !== null && first !== undefined ? first.patch_id : null;
  }

  private assignPatchIdsIfMissing(
    patches: readonly PatchInput[]
  ): PatchInput[] {
    return patches.map((p) =>
      typeof p.patchId === 'string' && p.patchId.length >= 8
        ? p
        : { ...p, patchId: crypto.randomUUID() }
    );
  }

  private assertPatchInputs(patches: PatchInput[]): void {
    assert.ok(patches.length > 0, 'patches must not be empty');
    assert.all(patches, (patch): asserts patch is PatchInput => {
      assertEntityKey(patch.entityId, patch.entityType);
      const raw = patch as Record<string, unknown>;
      if (
        raw['patchId'] !== undefined &&
        raw['patchId'] !== null &&
        typeof raw['patchId'] === 'string'
      ) {
        assertPatchId(raw['patchId']);
      }
      assert.all(
        Object.keys(patch.attributes),
        (key): asserts key is Attribute => assertAttribute(key)
      );
    });
  }

  private async insertPatchRowsBatch(
    tx: SqlClient,
    rows: PatchInsertBatchRow[]
  ): Promise<void> {
    assert.ok(rows.length > 0, 'insertPatchRowsBatch: rows must not be empty');
    await tx.run(INSERT_PATCHES_BATCH, [JSON.stringify(rows)]);
  }

  private async resolveWriteParentId(
    tx: SqlClient,
    patch: PatchInput,
    parentCache: Map<string, string | null>,
    patchIdsInBatch: ReadonlySet<string>
  ): Promise<string | null> {
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
      const parentRow = await tx.query<{ one: number }>(
        `SELECT 1 AS one FROM patches WHERE patch_id = ? LIMIT 1`,
        [clientParent]
      );
      if (parentRow.length > 0) {
        return clientParent;
      }
      const key = `${patch.entityId}\0${patch.entityType}`;
      if (!parentCache.has(key)) {
        parentCache.set(
          key,
          await this.resolveParentId(tx, patch.entityId, patch.entityType)
        );
      }
      return parentCache.get(key)!;
    }
    return await this.resolveParentId(tx, patch.entityId, patch.entityType);
  }

  private bumpWriteTimestamps(
    patch: PatchInput,
    lastTimestamp: number
  ): { now: string; recordedAt: string; lastTimestamp: number } {
    const t = lastTimestamp + 1;
    const now =
      'createdAt' in patch && typeof patch.createdAt === 'string'
        ? patch.createdAt
        : new Date(t).toISOString();
    const recordedAt =
      'recordedAt' in patch && typeof patch.recordedAt === 'string'
        ? patch.recordedAt
        : now;
    return { now, recordedAt, lastTimestamp: t };
  }

  private async accumulateWritePatches(
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
    let lastTimestamp = Date.now() - 1;
    for (const patch of sorted) {
      const entityKey = `${patch.entityId}\0${patch.entityType}`;
      const parentId = await this.resolveWriteParentId(
        tx,
        patch,
        parentCache,
        patchIdsInBatch
      );
      const ts = this.bumpWriteTimestamps(patch, lastTimestamp);
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

  private async compactEntityInTx(
    tx: SqlClient,
    entityId: string,
    entityType: string,
    keepLatest: number
  ): Promise<{ removedPatchIds: string[]; compactionPatchId: string | null }> {
    assertEntityKey(entityId, entityType);
    const rows = await tx.query<PatchRow>(SELECT_PATCHES_FOR_SNAPSHOT, [
      entityId,
      entityType,
      entityId,
      entityType,
      entityId,
      entityType,
    ]);
    const activeRows = rows.filter((r) => !patchRowIsSyncRejected(r));
    if (activeRows.length <= keepLatest + 1) {
      return { removedPatchIds: [], compactionPatchId: null };
    }

    const mergeSet = activeRows.slice(0, activeRows.length - keepLatest);
    const firstKept = activeRows[mergeSet.length];
    assert.defined(firstKept, 'compactEntityInTx: firstKept must exist');

    const merged = mergePatchRowsIntoSnapshotAttrs(
      mergeSet.map((r) => toPatchRow(r))
    );
    for (const k of PATCH_META_KEYS) {
      delete merged[k];
    }
    merged['patch/compacted'] = '1';
    merged[PATCH_CREATED_BY_ID] = PATCH_DB_SYSTEM_DEVICE_ID;
    merged['patch/sessionId'] = '';

    const now = new Date().toISOString();
    const patchId = crypto.randomUUID();
    await tx.run(INSERT_PATCH, [
      patchId,
      entityId,
      entityType,
      JSON.stringify(merged),
      now,
      now,
      null,
    ]);

    const removedPatchIds = await finishCompactionAfterInsert(tx, {
      compactionPatchId: patchId,
      entityId,
      entityType,
      mergeSet,
      firstKeptPatchId: firstKept.patch_id,
    });

    await recomputeSnapshotSingle(tx, entityId, entityType);
    return { removedPatchIds, compactionPatchId: patchId };
  }

  private async runAfterWriteCompactionPass(
    tx: SqlClient,
    touchedEntities: Set<string>
  ): Promise<void> {
    for (const key of touchedEntities) {
      const [entityId, entityType] = key.split('\0') as [string, string];
      await this.maybeAutoCompactAfterWrite(tx, entityId, entityType);
    }
  }

  private async maybeAutoCompactAfterWrite(
    tx: SqlClient,
    entityId: string,
    entityType: string
  ): Promise<void> {
    if (this.opts.autoCompactOnWrite !== true) return;
    const resolve =
      this.opts.compactionPolicy ?? (() => DEFAULT_PATCH_DB_COMPACTION_POLICY);
    const policy = resolve(entityType);
    if (policy === 'never') return;
    const slack = this.opts.compactionSlack ?? 2;
    const rows = await tx.query<PatchRow>(SELECT_PATCHES_FOR_SNAPSHOT, [
      entityId,
      entityType,
      entityId,
      entityType,
      entityId,
      entityType,
    ]);
    const activeCount = rows.filter((r) => !patchRowIsSyncRejected(r)).length;
    if (activeCount <= policy.keepLatest + slack) return;
    await this.compactEntityInTx(tx, entityId, entityType, policy.keepLatest);
  }

  async write(
    patches: PatchInput[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<WritePatchesResult> {
    this.assertPatchInputs(patches);
    const withIds = this.assignPatchIdsIfMissing(patches);
    let writtenPatches: Patch[] = [];
    let hookRejected: PatchRejectionReason[] = [];
    await this.sqlClient.transaction(async (tx) => {
      const { accepted, rejected } = await this.hooks.runBeforeWrite(
        withIds,
        ctx,
        tx
      );
      hookRejected = rejected;
      const sortedInput =
        accepted.length === 0 ? [] : topologicalSortPatches(accepted);
      const acc =
        sortedInput.length > 0
          ? await this.accumulateWritePatches(tx, sortedInput)
          : {
              writtenPatches: [] as Patch[],
              batchRows: [] as PatchInsertBatchRow[],
              touchedEntities: new Set<string>(),
            };
      writtenPatches = acc.writtenPatches;
      if (acc.batchRows.length > 0) {
        await this.insertPatchRowsBatch(tx, acc.batchRows);
      }
      await recomputeTouchedSnapshots(tx, acc.touchedEntities);
      await this.hooks.runAfterWrite(writtenPatches, ctx, tx);
      await this.runAfterWriteCompactionPass(tx, acc.touchedEntities);
    });
    return { accepted: writtenPatches, rejected: hookRejected };
  }

  async read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    const rewritten: PatchDbQuery[] = [];
    for (const q of queries) {
      rewritten.push(await this.hooks.runBeforeRead(q, ctx));
    }
    return readPatches(this.sqlClient, rewritten);
  }

  private async distinctEntityKeysForPatchIds(
    patchIds: readonly string[]
  ): Promise<Set<string>> {
    if (patchIds.length === 0) return new Set();
    const ph = patchIds.map(() => '?').join(', ');
    const rows = await this.sqlClient.query<{
      entity_id: string;
      entity_type: string;
    }>(
      `SELECT DISTINCT entity_id, entity_type FROM patches WHERE patch_id IN (${ph})`,
      [...patchIds]
    );
    const keys = new Set<string>();
    for (const r of rows) {
      keys.add(`${r.entity_id}\0${r.entity_type}`);
    }
    return keys;
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    _ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    void _ctx;
    if (updates.length === 0) return;
    const touchedPatchIds: string[] = [];
    for (const { patchId, attributes } of updates) {
      assertPatchId(patchId);
      if (Object.keys(attributes).length === 0) continue;
      for (const key of Object.keys(attributes)) {
        assertAttribute(key);
      }
      const bind: unknown[] = [];
      let expr = 'attributes::jsonb';
      for (const [key, value] of Object.entries(attributes)) {
        const jsonLiteral =
          value === undefined ? 'null' : JSON.stringify(value);
        expr = `jsonb_set(${expr}, ARRAY[?::text], ?::text::jsonb, true)`;
        bind.push(key, jsonLiteral);
      }
      const sql = `UPDATE patches SET attributes = ${expr} WHERE patch_id = ?`;
      assertWhereFragment(
        { sql, params: [...bind, patchId] },
        { context: 'PatchDbImplPostgres.update' }
      );
      await this.sqlClient.run(sql, [...bind, patchId]);
      touchedPatchIds.push(patchId);
    }
    if (touchedPatchIds.length === 0) return;
    const touchedEntities =
      await this.distinctEntityKeysForPatchIds(touchedPatchIds);
    if (touchedEntities.size === 0) return;
    await this.sqlClient.transaction(async (tx) => {
      await recomputeTouchedSnapshots(tx, touchedEntities);
    });
  }

  async compactEntity(
    key: { entityId: string; entityType: string },
    options: { keepLatest: number },
    _ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<{ removedPatchIds: string[]; compactionPatchId: string | null }> {
    void _ctx;
    let result: {
      removedPatchIds: string[];
      compactionPatchId: string | null;
    } = { removedPatchIds: [], compactionPatchId: null };
    await this.sqlClient.transaction(async (tx) => {
      result = await this.compactEntityInTx(
        tx,
        key.entityId,
        key.entityType,
        options.keepLatest
      );
    });
    return result;
  }

  async compactAll(
    options: { keepLatest?: number; entityType?: string },
    _ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<{ entitiesCompacted: number }> {
    void _ctx;
    const keepLatest = options.keepLatest ?? 2;
    const entityType = options.entityType;
    const rows = await this.sqlClient.query<{
      entity_id: string;
      entity_type: string;
    }>(
      entityType !== undefined && entityType !== ''
        ? 'SELECT DISTINCT entity_id, entity_type FROM patches WHERE entity_type = ?'
        : 'SELECT DISTINCT entity_id, entity_type FROM patches',
      entityType !== undefined && entityType !== '' ? [entityType] : []
    );
    let entitiesCompacted = 0;
    for (const r of rows) {
      const res = await this.compactEntity(
        { entityId: r.entity_id, entityType: r.entity_type },
        { keepLatest },
        OPEN_PATCHES_DB_CONTEXT
      );
      if (res.removedPatchIds.length > 0) entitiesCompacted += 1;
    }
    return { entitiesCompacted };
  }
}
