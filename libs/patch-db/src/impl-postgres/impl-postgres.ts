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
  DELETE_SNAPSHOT,
  INSERT_PATCH,
  MIGRATIONS,
  RESOLVE_PARENT_ID,
  SELECT_PATCHES_FOR_SNAPSHOT,
  UPSERT_SNAPSHOT,
} from './sql-constants';

function toPatchRow(row: PatchRow): PatchRow {
  return { ...row, attributes: rowAttributesText(row) };
}

type InsertPatchOptions = {
  patch: PatchInput;
  parentId: string | null;
  now: string;
  recordedAt: string;
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
        : crypto.randomUUID();
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
      for (const patch of sorted) {
        const isSyncedPatch =
          'patchId' in patch &&
          'parentId' in patch &&
          typeof patch.patchId === 'string';
        const parentId: string | null = isSyncedPatch
          ? typeof patch.parentId === 'string'
            ? patch.parentId
            : null
          : await this.resolveParentId(tx, patch.entityId, patch.entityType);
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
