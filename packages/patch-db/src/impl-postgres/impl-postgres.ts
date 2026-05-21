import type { Keyword } from '@gamezilla/keyword';
import { assert } from '@gamezilla/assert';
import type { Logger } from '@gamezilla/logger';
import type { SqlClient } from '@gamezilla/sql-client/interface';
import { assertWhereFragment } from '@gamezilla/sqlite';
import { PatchDbHookRegistry } from '../hook-registry';
import type { PatchRow } from '../impl-sqlite/types';
import type {
  Patch,
  PatchDb,
  PatchDbContext,
  PatchDbCompaction,
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
  OPEN_PATCHES_DB_CONTEXT,
  PATCH_META_KEYS,
} from '../interface';
import { patchRowIsSyncRejected } from '../patch-row-sync-rejected';
import { PATCH_CREATED_BY_ID } from '../metadata/patch-metadata';
import { DEFAULT_PATCH_DB_COMPACTION_POLICY } from '../policy/compaction-policy';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '../policy/system-device';
import { finishCompactionAfterInsert } from '../compact-entity-tx-helpers';
import { topologicalSortPatches } from '../topological-sort';
import {
  accumulateWritePatchesPostgres,
  type PatchInsertBatchRow,
} from './accumulate-write-patches-postgres';
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
  RESOLVE_PARENT_IDS_BATCH,
  SELECT_PATCHES_FOR_SNAPSHOT,
} from './sql-constants';

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

  /**
   * Idempotent Postgres DDL for patches + snapshots (no instance required).
   *
   * When `options.indexes` is supplied, declarative snapshot indexes are
   * reconciled after base DDL: indexes declared in code but absent in DB are
   * created; indexes present in DB under the `pdb_idx_` prefix that are no
   * longer declared are dropped. Non-`pdb_idx_` indexes (engine-owned and
   * unrelated app indexes) are never touched.
   */
  static async migrateUp(args: {
    sqlClient: SqlClient;
    logger: Logger;
    options?: PatchDbEngineOptions;
  }): Promise<void> {
    const indexes = args.options?.indexes;
    await migratePatchDbPostgres({
      sqlClient: args.sqlClient,
      logger: args.logger,
      ...(indexes !== undefined ? { indexes } : {}),
    });
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

  private async resolveParentIdsBatch(
    tx: SqlClient,
    entities: readonly { entityId: string; entityType: string }[]
  ): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    if (entities.length === 0) return out;
    const payload = entities.map((e) => ({
      entity_id: e.entityId,
      entity_type: e.entityType,
    }));
    const rows = await tx.query<{
      entity_id: string;
      entity_type: string;
      patch_id: string;
    }>(RESOLVE_PARENT_IDS_BATCH, [JSON.stringify(payload)]);
    for (const r of rows) {
      out.set(`${r.entity_id}\0${r.entity_type}`, r.patch_id);
    }
    return out;
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
      assert.all(Object.keys(patch.attributes), (key): asserts key is Keyword =>
        assertAttribute(key)
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
    return accumulateWritePatchesPostgres(
      {
        resolveParentId: (t, entityId, entityType) =>
          this.resolveParentId(t, entityId, entityType),
        resolveParentIdsBatch: (t, entities) =>
          this.resolveParentIdsBatch(t, entities),
        bumpWriteTimestamps: (p, t) => this.bumpWriteTimestamps(p, t),
      },
      tx,
      sorted
    );
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
    Object.assign(merged, {
      'patch/compacted': '1',
      [PATCH_CREATED_BY_ID]: PATCH_DB_SYSTEM_DEVICE_ID,
      'patch/session-id': '',
    });

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
    const enrichedCtx = await this.hooks.runEnrichContext(ctx);
    let writtenPatches: Patch[] = [];
    let hookRejected: PatchRejectionReason[] = [];
    await this.sqlClient.transaction(async (tx) => {
      const { accepted, rejected } = await this.hooks.runBeforeWrite(
        withIds,
        enrichedCtx,
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
      await this.hooks.runAfterWrite(writtenPatches, enrichedCtx, tx);
      await this.runAfterWriteCompactionPass(tx, acc.touchedEntities);
    });
    return { accepted: writtenPatches, rejected: hookRejected };
  }

  async read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    const enrichedCtx = await this.hooks.runEnrichContext(ctx);
    const rewritten: PatchDbQuery[] = [];
    for (const q of queries) {
      rewritten.push(await this.hooks.runBeforeRead(q, enrichedCtx));
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
