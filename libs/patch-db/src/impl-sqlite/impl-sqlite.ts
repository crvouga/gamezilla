import { assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import {
  assertAttribute,
  assertEntityKey,
  assertPatchId,
  Attribute,
  getPatchTopLevelFromAttributes,
  isValidAttribute,
  normalizePatchAttributesForStorage,
  OPEN_PATCHES_DB_CONTEXT,
  Patch,
  PatchDbEngineOptions,
  PATCH_META_KEYS,
  PatchesDb,
  PatchesDbCompaction,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
  topologicalSortPatches,
} from '../interface';
import { PatchDbHookRegistry } from '../hook-registry';
import { DEFAULT_PATCH_DB_COMPACTION_POLICY } from '../policy/compaction-policy';
import { PATCH_DB_SYSTEM_PRINCIPAL_ID } from '../policy/system-principal';
import { parseAttributes } from './mappers';
import { migratePatchDbSqlite } from './migrate';
import { readPatches } from './read-ops';
import {
  DELETE_PATCH_BY_ID,
  DELETE_SNAPSHOT,
  INSERT_PATCH,
  RESOLVE_PARENT_ID,
  SELECT_PATCHES_FOR_SNAPSHOT,
  UPSERT_SNAPSHOT,
} from './sql-constants';
import type { PatchRow } from './types';
import { buildSqliteUpdateJsonSet } from './update-ops';

type InsertPatchOptions = {
  patch: PatchInput;
  parentId: string | null;
  now: string;
  recordedAt: string;
};

export class PatchDbImplSqlite implements PatchesDb {
  readonly hooks = new PatchDbHookRegistry();

  readonly compaction: PatchesDbCompaction = {
    compactEntity: (key, options, ctx) =>
      this.compactEntity(key, options, ctx),
    compactAll: (options, ctx) => this.compactAll(options, ctx),
  };

  constructor(
    private readonly sqlClient: SqlClient,
    private readonly opts: PatchDbEngineOptions = {}
  ) {}

  async migrate(): Promise<void> {
    await migratePatchDbSqlite(this.sqlClient);
  }

  private mergePatchRowsIntoMergedRecord(rows: readonly PatchRow[]): Record<
    string,
    unknown
  > {
    const merged: Record<string, unknown> = {};
    for (const row of rows) {
      const attrs = parseAttributes(row.attributes, {
        entity_id: row.entity_id,
        entity_type: row.entity_type,
        patch_id: row.patch_id,
      });
      for (const [key, value] of Object.entries(attrs)) {
        if (!isValidAttribute(key) || PATCH_META_KEYS.includes(key)) continue;
        if (value === null) {
          delete merged[key];
        } else {
          merged[key] = value;
        }
      }
    }
    return merged;
  }

  private async recomputeSnapshot(
    tx: SqlClient,
    entityId: string,
    entityType: string
  ): Promise<void> {
    assertEntityKey(entityId, entityType);
    const rows = await tx.query<PatchRow>(SELECT_PATCHES_FOR_SNAPSHOT, [
      entityId,
      entityType,
      entityId,
      entityType,
      entityId,
      entityType,
    ]);

    const merged = this.mergePatchRowsIntoMergedRecord(rows);

    if (Object.keys(merged).length === 0) {
      await tx.run(DELETE_SNAPSHOT, [entityId, entityType]);
    } else {
      await tx.run(UPSERT_SNAPSHOT, [
        entityId,
        entityType,
        JSON.stringify(merged),
      ]);
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

  private async recomputeTouchedSnapshots(
    tx: SqlClient,
    touchedEntities: Set<string>
  ): Promise<void> {
    for (const key of touchedEntities) {
      const parts = key.split('\0');
      assert.ok(
        parts.length === 2,
        'Entity key must contain exactly one null separator',
        { key }
      );
      const entityId = parts[0];
      assert.defined(
        entityId,
        'Entity key must contain exactly one null separator'
      );
      const entityType = parts[1];
      assert.defined(
        entityType,
        'Entity key must contain exactly one null separator'
      );
      await this.recomputeSnapshot(tx, entityId, entityType);
    }
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

    const merged = this.mergePatchRowsIntoMergedRecord(mergeSet);
    for (const k of PATCH_META_KEYS) {
      delete merged[k];
    }
    merged['patch/compacted'] = '1';
    merged['patch/createdBy'] = PATCH_DB_SYSTEM_PRINCIPAL_ID;
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

    await tx.run(`UPDATE patches SET parent_id = ? WHERE patch_id = ?`, [
      writtenCompaction.patchId,
      firstKept.patch_id,
    ]);

    const removedPatchIds: string[] = [];
    for (let i = mergeSet.length - 1; i >= 0; i--) {
      const row = mergeSet[i];
      assert.defined(row, 'mergeSet row');
      await tx.run(DELETE_PATCH_BY_ID, [row.patch_id]);
      removedPatchIds.push(row.patch_id);
    }

    await this.recomputeSnapshot(tx, entityId, entityType);
    return {
      removedPatchIds,
      compactionPatchId: writtenCompaction.patchId,
    };
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
    const writtenPatches: Patch[] = [];
    await this.sqlClient.transaction(async (tx) => {
      const sortedInput = topologicalSortPatches(
        await this.hooks.runBeforeWrite(patches, ctx, tx)
      );
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
      await this.recomputeTouchedSnapshots(tx, touchedEntities);
      await this.hooks.runAfterWrite(writtenPatches, ctx, tx);
      for (const key of touchedEntities) {
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
      const { expr, params } = buildSqliteUpdateJsonSet(attributes);
      await this.sqlClient.run(
        `UPDATE patches SET attributes = ${expr} WHERE patch_id = ?`,
        [...params, patchId]
      );
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
