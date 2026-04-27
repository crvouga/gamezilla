import { assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type { PatchRow } from '../impl-sqlite/types';
import {
  assertAttribute,
  assertEntityKey,
  assertPatchId,
  Attribute,
  getPatchTopLevelFromAttributes,
  isValidAttribute,
  normalizePatchAttributesForStorage,
  Patch,
  PATCH_META_KEYS,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
  topologicalSortPatches,
} from '../interface';
import { parseAttributes, readPatches, rowAttributesText } from './read-ops';
import {
  INSERT_PATCHES_BATCH,
  MIGRATIONS,
  RESOLVE_PARENT_ID,
  UPSERT_SNAPSHOTS_BATCH,
} from './sql-constants';

function toPatchRow(row: PatchRow): PatchRow {
  return { ...row, attributes: rowAttributesText(row) };
}

/** `(?, ?)` list duplicated in SQL; params are `[...pairs, ...pairs]`. */
type SnapshotEntityPair = {
  entityId: string;
  entityType: string;
  key: string;
};

function collectSnapshotEntityPairs(
  touchedEntities: Set<string>
): SnapshotEntityPair[] {
  const entityPairs: SnapshotEntityPair[] = [];
  for (const key of touchedEntities) {
    const parts = key.split('\0');
    assert.ok(
      parts.length === 2,
      'Entity key must contain exactly one null separator',
      { key }
    );
    const entityId = parts[0];
    const entityType = parts[1];
    assert.defined(
      entityId,
      'Entity key must contain exactly one null separator'
    );
    assert.defined(
      entityType,
      'Entity key must contain exactly one null separator'
    );
    assertEntityKey(entityId, entityType);
    entityPairs.push({ entityId, entityType, key });
  }
  return entityPairs;
}

function groupSnapshotPatchRowsByKey(rows: PatchRow[]): Map<string, PatchRow[]> {
  const rowsByKey = new Map<string, PatchRow[]>();
  for (const row of rows) {
    const k = `${row.entity_id}\0${row.entity_type}`;
    const list = rowsByKey.get(k);
    if (list !== undefined) {
      list.push(row);
    } else {
      rowsByKey.set(k, [row]);
    }
  }
  return rowsByKey;
}

function buildSelectPatchesForSnapshotBatchSql(valuesPlaceholder: string): string {
  return `WITH RECURSIVE lineage AS (
    SELECT patch_id, entity_id, entity_type, 0 AS depth
    FROM patches
    WHERE parent_id IS NULL AND (entity_id, entity_type) IN (VALUES ${valuesPlaceholder})
    UNION ALL
    SELECT p.patch_id, p.entity_id, p.entity_type, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
      AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
)
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
       p.created_at, p.recorded_at, p.parent_id
FROM patches p
JOIN lineage l ON p.patch_id = l.patch_id
  AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
WHERE (p.entity_id, p.entity_type) IN (VALUES ${valuesPlaceholder})
ORDER BY p.entity_id ASC, p.entity_type ASC, l.depth ASC, p.patch_id ASC`;
}

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
  constructor(private sqlClient: SqlClient) {}

  async migrate(): Promise<void> {
    const existing = await this.sqlClient.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('patches', 'snapshots')`
    );
    if (existing.length >= 2) return;

    const statements = MIGRATIONS.split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await this.sqlClient.run(stmt);
    }
  }

  private mergePatchRowsIntoSnapshotAttrs(
    rows: readonly PatchRow[]
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const row of rows) {
      const r = toPatchRow(row);
      const attrs = parseAttributes(r.attributes, {
        entity_id: r.entity_id,
        entity_type: r.entity_type,
        patch_id: r.patch_id,
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
    parentCache: Map<string, string | null>
  ): Promise<string | null> {
    const isSyncedPatch =
      'patchId' in patch &&
      'parentId' in patch &&
      typeof patch.patchId === 'string';
    if (isSyncedPatch) {
      return typeof patch.parentId === 'string' ? patch.parentId : null;
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
    let lastTimestamp = Date.now() - 1;
    for (const patch of sorted) {
      const entityKey = `${patch.entityId}\0${patch.entityType}`;
      const parentId = await this.resolveWriteParentId(tx, patch, parentCache);
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

  private buildSnapshotMutations(
    entityPairs: readonly SnapshotEntityPair[],
    rowsByKey: ReadonlyMap<string, PatchRow[]>
  ): {
    deleteParams: unknown[];
    upsertPayload: {
      entity_id: string;
      entity_type: string;
      attributes: Record<string, unknown>;
    }[];
  } {
    const deleteParams: unknown[] = [];
    const upsertPayload: {
      entity_id: string;
      entity_type: string;
      attributes: Record<string, unknown>;
    }[] = [];
    for (const { entityId, entityType, key } of entityPairs) {
      const merged = this.mergePatchRowsIntoSnapshotAttrs(
        rowsByKey.get(key) ?? []
      );
      if (Object.keys(merged).length === 0) {
        deleteParams.push(entityId, entityType);
      } else {
        upsertPayload.push({
          entity_id: entityId,
          entity_type: entityType,
          attributes: merged,
        });
      }
    }
    return { deleteParams, upsertPayload };
  }

  private async runSnapshotDeletes(
    tx: SqlClient,
    deleteParams: unknown[]
  ): Promise<void> {
    if (deleteParams.length === 0) return;
    const delPh = Array.from(
      { length: deleteParams.length / 2 },
      () => '(?, ?)'
    ).join(', ');
    await tx.run(
      `DELETE FROM snapshots WHERE (entity_id, entity_type) IN (VALUES ${delPh})`,
      deleteParams
    );
  }

  private async runSnapshotUpsertsBatch(
    tx: SqlClient,
    upsertPayload: readonly {
      entity_id: string;
      entity_type: string;
      attributes: Record<string, unknown>;
    }[]
  ): Promise<void> {
    if (upsertPayload.length === 0) return;
    await tx.run(UPSERT_SNAPSHOTS_BATCH, [JSON.stringify(upsertPayload)]);
  }

  private async recomputeTouchedSnapshots(
    tx: SqlClient,
    touchedEntities: Set<string>
  ): Promise<void> {
    if (touchedEntities.size === 0) return;
    const entityPairs = collectSnapshotEntityPairs(touchedEntities);
    const valuesPh = entityPairs.map(() => '(?, ?)').join(', ');
    const pairParams = entityPairs.flatMap((p) => [p.entityId, p.entityType]);
    const patchRows = await tx.query<PatchRow>(
      buildSelectPatchesForSnapshotBatchSql(valuesPh),
      [...pairParams, ...pairParams]
    );
    const rowsByKey = groupSnapshotPatchRowsByKey(patchRows);
    const { deleteParams, upsertPayload } = this.buildSnapshotMutations(
      entityPairs,
      rowsByKey
    );
    await this.runSnapshotDeletes(tx, deleteParams);
    await this.runSnapshotUpsertsBatch(tx, upsertPayload);
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    this.assertPatchInputs(patches);
    const sorted = topologicalSortPatches(patches);
    let writtenPatches: Patch[] = [];
    await this.sqlClient.transaction(async (tx) => {
      const acc = await this.accumulateWritePatches(tx, sorted);
      writtenPatches = acc.writtenPatches;
      await this.insertPatchRowsBatch(tx, acc.batchRows);
      await this.recomputeTouchedSnapshots(tx, acc.touchedEntities);
    });
    return writtenPatches;
  }

  async read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    return readPatches(this.sqlClient, queries);
  }

  async update(
    updates: { patchId: string; attributes: Record<string, unknown> }[]
  ): Promise<void> {
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
}
