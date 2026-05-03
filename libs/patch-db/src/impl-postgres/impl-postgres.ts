import { assert } from '@gamezilla/lib/assert';
import type { Logger } from '@gamezilla/lib/logger';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { PatchDbHookRegistry } from '../hook-registry';
import type { PatchRow } from '../impl-sqlite/types';
import type {
  Attribute,
  Patch,
  PatchDbEngineOptions,
  PatchesDb,
  PatchesDbCompaction,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
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
import { DEFAULT_PATCH_DB_COMPACTION_POLICY } from '../policy/compaction-policy';
import { PATCH_DB_SYSTEM_PRINCIPAL_ID } from '../policy/system-principal';
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
  DELETE_PATCH_BY_ID,
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

export class PatchDbImplPostgres implements PatchesDb {
  readonly hooks = new PatchDbHookRegistry();

  readonly compaction: PatchesDbCompaction = {
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
    if (rows.length <= keepLatest + 1) {
      return { removedPatchIds: [], compactionPatchId: null };
    }

    const mergeSet = rows.slice(0, rows.length - keepLatest);
    const firstKept = rows[mergeSet.length];
    assert.defined(firstKept, 'compactEntityInTx: firstKept must exist');

    const merged = mergePatchRowsIntoSnapshotAttrs(
      mergeSet.map((r) => toPatchRow(r))
    );
    for (const k of PATCH_META_KEYS) {
      delete merged[k];
    }
    merged['patch/compacted'] = '1';
    merged['patch/createdBy'] = PATCH_DB_SYSTEM_PRINCIPAL_ID;
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

    await tx.run(`UPDATE patches SET parent_id = ? WHERE patch_id = ?`, [
      patchId,
      firstKept.patch_id,
    ]);

    const removedPatchIds: string[] = [];
    for (let i = mergeSet.length - 1; i >= 0; i--) {
      const row = mergeSet[i];
      assert.defined(row, 'mergeSet row');
      await tx.run(DELETE_PATCH_BY_ID, [row.patch_id]);
      removedPatchIds.push(row.patch_id);
    }

    await recomputeSnapshotSingle(tx, entityId, entityType);
    return { removedPatchIds, compactionPatchId: patchId };
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
    if (rows.length <= policy.keepLatest + slack) return;
    await this.compactEntityInTx(tx, entityId, entityType, policy.keepLatest);
  }

  async write(
    patches: PatchInput[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<Patch[]> {
    this.assertPatchInputs(patches);
    let writtenPatches: Patch[] = [];
    await this.sqlClient.transaction(async (tx) => {
      const sortedInput = topologicalSortPatches(
        await this.hooks.runBeforeWrite(patches, ctx, tx)
      );
      const acc = await this.accumulateWritePatches(tx, sortedInput);
      writtenPatches = acc.writtenPatches;
      await this.insertPatchRowsBatch(tx, acc.batchRows);
      await recomputeTouchedSnapshots(tx, acc.touchedEntities);
      await this.hooks.runAfterWrite(writtenPatches, ctx, tx);
      for (const key of acc.touchedEntities) {
        const [entityId, entityType] = key.split('\0') as [string, string];
        await this.maybeAutoCompactAfterWrite(tx, entityId, entityType);
      }
    });
    return writtenPatches;
  }

  async read(
    queries: PatchesDbQuery[],
    ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchesDbResult[]> {
    const rewritten: PatchesDbQuery[] = [];
    for (const q of queries) {
      rewritten.push(await this.hooks.runBeforeRead(q, ctx));
    }
    return readPatches(this.sqlClient, rewritten);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[],
    _ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<void> {
    void _ctx;
    if (updates.length === 0) return;
    for (const { patchId, attributes } of updates) {
      if (Object.keys(attributes).length === 0) continue;
      for (const key of Object.keys(attributes)) {
        assertAttribute(key);
      }
      const bind: unknown[] = [];
      let expr = 'attributes::jsonb';
      for (const [key, value] of Object.entries(attributes)) {
        const jsonLiteral =
          value === undefined ? 'null' : JSON.stringify(value);
        expr = `jsonb_set(${expr}, ARRAY[?::text], CAST(? AS jsonb), true)`;
        bind.push(key, jsonLiteral);
      }
      const sql = `UPDATE patches SET attributes = ${expr} WHERE patch_id = ?`;
      await this.sqlClient.run(sql, [...bind, patchId]);
    }
  }

  async compactEntity(
    key: { entityId: string; entityType: string },
    options: { keepLatest: number },
    _ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
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
    _ctx: PatchesDbContext = OPEN_PATCHES_DB_CONTEXT
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
