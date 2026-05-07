import { assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { assertWhereFragment } from '@gamezilla/lib/sqlite';
import { PatchDbHookRegistry } from '../hook-registry';
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
import { migratePatchDbSqlite } from './migrate';
import { readPatches } from './read-ops';
import {
  mergePatchRowsIntoMergedRecord,
  recomputeSnapshot,
  recomputeTouchedSnapshots,
} from './sqlite-snapshot-recompute';
import {
  INSERT_PATCH,
  RESOLVE_PARENT_ID,
  SELECT_PATCHES_FOR_SNAPSHOT,
} from './sql-constants';
import type { PatchRow } from './types';
import { buildSqliteUpdateJsonSet } from './update-ops';

type InsertPatchOptions = {
  patch: PatchInput;
  parentId: string | null;
  now: string;
  recordedAt: string;
};

export class PatchDbImplSqlite implements PatchDb {
  readonly hooks = new PatchDbHookRegistry();
  private hasEnsuredCoreTables = false;
  private ensureCoreTablesInFlight: Promise<void> | null = null;

  readonly compaction: PatchDbCompaction = {
    compactEntity: (key, options, ctx) => this.compactEntity(key, options, ctx),
    compactAll: (options, ctx) => this.compactAll(options, ctx),
  };

  constructor(
    private readonly sqlClient: SqlClient,
    private readonly opts: PatchDbEngineOptions = {}
  ) {}

  async migrate(): Promise<void> {
    await migratePatchDbSqlite(this.sqlClient);
    this.hasEnsuredCoreTables = true;
  }

  private async queryCoreTableNames(): Promise<string[]> {
    const rows = await this.sqlClient.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('patches', 'snapshots')"
    );
    return rows.map((r) => r.name);
  }

  private hasRequiredCoreTables(tableNames: readonly string[]): boolean {
    return tableNames.includes('patches') && tableNames.includes('snapshots');
  }

  private async ensureCoreTables(force = false): Promise<void> {
    if (!force && this.hasEnsuredCoreTables) return;
    if (this.ensureCoreTablesInFlight !== null) {
      await this.ensureCoreTablesInFlight;
      return;
    }
    this.ensureCoreTablesInFlight = (async () => {
      const tableNames = await this.queryCoreTableNames();
      if (!this.hasRequiredCoreTables(tableNames)) {
        await migratePatchDbSqlite(this.sqlClient);
      }
      this.hasEnsuredCoreTables = true;
    })();
    try {
      await this.ensureCoreTablesInFlight;
    } finally {
      this.ensureCoreTablesInFlight = null;
    }
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

  private assignPatchIdsIfMissing(
    patches: readonly PatchInput[]
  ): PatchInput[] {
    return patches.map((p) =>
      typeof p.patchId === 'string' && p.patchId.length >= 8
        ? p
        : { ...p, patchId: globalThis.crypto.randomUUID() }
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

  private async insertPatchRow(
    tx: SqlClient,
    options: InsertPatchOptions
  ): Promise<Patch> {
    const { patch, parentId, now, recordedAt } = options;
    const storedAttributes = normalizePatchAttributesForStorage(patch);
    const { createdBy, sessionId } =
      getPatchTopLevelFromAttributes(storedAttributes);
    const patchId =
      'patchId' in patch && typeof patch.patchId === 'string'
        ? patch.patchId
        : globalThis.crypto.randomUUID();
    await tx.run(INSERT_PATCH, [
      patchId,
      patch.entityId,
      patch.entityType,
      JSON.stringify(storedAttributes),
      now,
      recordedAt,
      parentId,
    ]);
    return {
      ...patch,
      patchId,
      parentId,
      createdAt: now,
      recordedAt,
      createdBy,
      sessionId,
    };
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

    const merged = mergePatchRowsIntoMergedRecord(mergeSet);
    for (const k of PATCH_META_KEYS) {
      delete merged[k];
    }
    merged['patch/compacted'] = '1';
    merged[PATCH_CREATED_BY_ID] = PATCH_DB_SYSTEM_DEVICE_ID;
    merged['patch/sessionId'] = '';

    const now = new Date().toISOString();
    const compactionPatch: PatchInput = {
      entityId,
      entityType,
      attributes: merged,
    };
    const writtenCompaction = await this.insertPatchRow(tx, {
      patch: compactionPatch,
      parentId: null,
      now,
      recordedAt: now,
    });

    const removedPatchIds = await finishCompactionAfterInsert(tx, {
      compactionPatchId: writtenCompaction.patchId,
      entityId,
      entityType,
      mergeSet,
      firstKeptPatchId: firstKept.patch_id,
    });

    await recomputeSnapshot(tx, entityId, entityType);
    return {
      removedPatchIds,
      compactionPatchId: writtenCompaction.patchId,
    };
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
    await this.ensureCoreTables();
    this.assertPatchInputs(patches);
    const withIds = this.assignPatchIdsIfMissing(patches);
    const writeOnce = async (): Promise<WritePatchesResult> => {
      const writtenPatches: Patch[] = [];
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
        const touchedEntities = new Set<string>();
        let lastTimestamp = Date.now() - 1;
        const sorted = sortedInput;
        const parentCache = new Map<string, string | null>();
        const patchIdsInBatch = new Set<string>();
        for (const p of sorted) {
          if ('patchId' in p && typeof p.patchId === 'string') {
            patchIdsInBatch.add(p.patchId);
          }
        }
        for (const patch of sorted) {
          const parentId = await this.resolveWriteParentId(
            tx,
            patch,
            parentCache,
            patchIdsInBatch
          );
          lastTimestamp += 1;
          const now =
            'createdAt' in patch && typeof patch.createdAt === 'string'
              ? patch.createdAt
              : new Date(lastTimestamp).toISOString();
          const recordedAt =
            'recordedAt' in patch && typeof patch.recordedAt === 'string'
              ? patch.recordedAt
              : now;
          const written = await this.insertPatchRow(tx, {
            patch,
            parentId,
            now,
            recordedAt,
          });
          writtenPatches.push(written);
          touchedEntities.add(`${patch.entityId}\0${patch.entityType}`);
        }
        await recomputeTouchedSnapshots(tx, touchedEntities);
        await this.hooks.runAfterWrite(writtenPatches, ctx, tx);
        await this.runAfterWriteCompactionPass(tx, touchedEntities);
      });
      return { accepted: writtenPatches, rejected: hookRejected };
    };
    try {
      return await writeOnce();
    } catch (error) {
      const tableNames = await this.queryCoreTableNames().catch(() => []);
      if (!this.hasRequiredCoreTables(tableNames)) {
        this.hasEnsuredCoreTables = false;
        await this.ensureCoreTables(true);
        return await writeOnce();
      }
      throw error;
    }
  }

  async read(
    queries: PatchDbQuery[],
    ctx: PatchDbContext = OPEN_PATCHES_DB_CONTEXT
  ): Promise<PatchDbResult[]> {
    await this.ensureCoreTables();
    try {
      const rewritten: PatchDbQuery[] = [];
      for (const q of queries) {
        rewritten.push(await this.hooks.runBeforeRead(q, ctx));
      }
      return readPatches(this.sqlClient, rewritten);
    } catch (error) {
      const tableNames = await this.queryCoreTableNames().catch(() => []);
      if (!this.hasRequiredCoreTables(tableNames)) {
        await this.ensureCoreTables(true);
        const rewrittenRetry: PatchDbQuery[] = [];
        for (const q of queries) {
          rewrittenRetry.push(await this.hooks.runBeforeRead(q, ctx));
        }
        return readPatches(this.sqlClient, rewrittenRetry);
      }
      throw error;
    }
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
    await this.ensureCoreTables();
    try {
      if (updates.length === 0) return;
      const touchedPatchIds: string[] = [];
      for (const { patchId, attributes } of updates) {
        assertPatchId(patchId);
        if (Object.keys(attributes).length === 0) continue;
        for (const key of Object.keys(attributes)) {
          assertAttribute(key);
        }
        const { expr, params } = buildSqliteUpdateJsonSet(attributes);
        const sql = `UPDATE patches SET attributes = ${expr} WHERE patch_id = ?`;
        assertWhereFragment(
          { sql, params: [...params, patchId] },
          { context: 'PatchDbImplSqlite.update' }
        );
        await this.sqlClient.run(sql, [...params, patchId]);
        touchedPatchIds.push(patchId);
      }
      if (touchedPatchIds.length === 0) return;
      const touchedEntities =
        await this.distinctEntityKeysForPatchIds(touchedPatchIds);
      if (touchedEntities.size === 0) return;
      await this.sqlClient.transaction(async (tx) => {
        await recomputeTouchedSnapshots(tx, touchedEntities);
      });
    } catch (error) {
      const tableNames = await this.queryCoreTableNames().catch(() => []);
      if (!this.hasRequiredCoreTables(tableNames)) {
        this.hasEnsuredCoreTables = false;
        await this.ensureCoreTables(true);
        await this.update(updates, _ctx);
        return;
      }
      throw error;
    }
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
