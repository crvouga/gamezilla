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
  Patch,
  PATCH_META_KEYS,
  PATCH_META_LEGACY_KEY_MAP,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
  topologicalSortPatches,
} from '../interface';
import { parseAttributes } from './mappers';
import { readPatches } from './read-ops';
import {
  DELETE_SNAPSHOT,
  INSERT_PATCH,
  MIGRATIONS,
  RESOLVE_PARENT_ID,
  SELECT_PATCHES_FOR_SNAPSHOT,
  UPSERT_SNAPSHOT,
} from './sql-constants';
import type { PatchRow } from './types';

type InsertPatchOptions = {
  patch: PatchInput;
  parentId: string | null;
  now: string;
  recordedAt: string;
};

export class PatchDbImplSqlite implements PatchesDb {
  constructor(private sqlClient: SqlClient) {}

  async migrate(): Promise<void> {
    const statements = MIGRATIONS.split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await this.sqlClient.run(stmt);
    }
    await this.dropLegacyLineageDepth();
    await this.dropLegacyLineageIndex();
    await this.migrateLegacyMetadataColumn();
  }

  private async dropLegacyLineageDepth(): Promise<void> {
    try {
      await this.sqlClient.run('ALTER TABLE patches DROP COLUMN lineage_depth');
    } catch {
      // Forward-compatible: old schema may not have lineage_depth; new DBs skip.
    }
  }

  private async dropLegacyLineageIndex(): Promise<void> {
    try {
      await this.sqlClient.run(
        'DROP INDEX IF EXISTS idx_patches_entity_type_lineage'
      );
    } catch {
      // Forward-compatible: index may be absent on fresh DB or already removed.
    }
  }

  private async migrateLegacyMetadataColumn(): Promise<void> {
    try {
      const tableInfo = await this.sqlClient.query<{ name: string }>(
        "SELECT name FROM pragma_table_info('patches') WHERE name = 'metadata'"
      );
      if (tableInfo.length === 0) return;
      const jsonSetArgs = (PATCH_META_KEYS as readonly string[])
        .flatMap((attrKey) => {
          const legacyKey = PATCH_META_LEGACY_KEY_MAP[attrKey];
          const path = `'$.${attrKey.replace(/"/g, '""')}'`;
          const expr =
            attrKey === 'patch/syncedAt'
              ? `json_extract(metadata, '$.${legacyKey}')`
              : `coalesce(json_extract(metadata, '$.${legacyKey}'), '')`;
          return [path, expr];
        })
        .join(', ');
      await this.sqlClient.run(
        `UPDATE patches SET attributes = json_set(attributes, ${jsonSetArgs})`
      );
      await this.sqlClient.run('ALTER TABLE patches DROP COLUMN metadata');
    } catch {
      // Forward-compatible: metadata column exists only in pre-migration DBs.
    }
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

  async write(patches: PatchInput[]): Promise<Patch[]> {
    this.assertPatchInputs(patches);
    const writtenPatches: Patch[] = [];
    await this.sqlClient.transaction(async (tx) => {
      const touchedEntities = new Set<string>();
      let lastTimestamp = Date.now() - 1;
      const sorted = topologicalSortPatches(patches);
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
      const jsonSetParts: string[] = [];
      const jsonSetParams: unknown[] = [];
      for (const [key, value] of Object.entries(attributes)) {
        const path = /[./[\]]/.test(key)
          ? `$."${key.replace(/"/g, '""')}"`
          : `$.${key}`;
        jsonSetParts.push(`'${path.replace(/'/g, "''")}', ?`);
        const sqlValue =
          value === undefined
            ? null
            : typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : value;
        jsonSetParams.push(sqlValue);
      }
      const jsonSetExpr = `json_set(attributes, ${jsonSetParts.join(', ')})`;
      await this.sqlClient.run(
        `UPDATE patches SET attributes = ${jsonSetExpr} WHERE patch_id = ?`,
        [...jsonSetParams, patchId]
      );
    }
  }
}
