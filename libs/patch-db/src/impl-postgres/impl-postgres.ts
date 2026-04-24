import { assert } from '@gamezilla/lib/assert';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { parseAttributes, toEntity, toPatch } from '../impl-sqlite/mappers';
import type { PatchRow, SnapshotRow } from '../impl-sqlite/types';
import {
  assertAttribute,
  assertEntityKey,
  assertPatchId,
  Attribute,
  Entity,
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
import {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
} from './query-builder-pg';

const DELETE_SNAPSHOT = `DELETE FROM snapshots
WHERE entity_id = ? AND entity_type = ?`;

const INSERT_PATCH = `INSERT INTO patches (
        patch_id,
        entity_id,
        entity_type,
        attributes,
        created_at,
        recorded_at,
        parent_id
    )
VALUES (?, ?, ?, CAST(? AS jsonb), ?, ?, ?)
ON CONFLICT (patch_id) DO NOTHING`;

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS patches (
    patch_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::TEXT),
    parent_id TEXT REFERENCES patches (patch_id)
);

CREATE INDEX IF NOT EXISTS idx_patches_entity_id ON patches (entity_id);

CREATE INDEX IF NOT EXISTS idx_patches_parent_id ON patches (parent_id);

CREATE TABLE IF NOT EXISTS snapshots (
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (entity_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_entity_type ON snapshots (entity_type);
`;

const RESOLVE_PARENT_ID = `WITH RECURSIVE lineage AS (
    SELECT patch_id, 0 AS depth
    FROM patches
    WHERE entity_id = ? AND entity_type = ? AND parent_id IS NULL
    UNION ALL
    SELECT p.patch_id, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
    WHERE p.entity_id = ? AND p.entity_type = ?
)
SELECT p.patch_id FROM patches p
JOIN lineage l ON p.patch_id = l.patch_id
WHERE p.entity_id = ? AND p.entity_type = ?
  AND NOT EXISTS (
    SELECT 1 FROM patches c
    WHERE c.parent_id = p.patch_id
      AND c.entity_id = p.entity_id AND c.entity_type = p.entity_type
  )
ORDER BY l.depth DESC, p.patch_id ASC
LIMIT 1`;

const SELECT_PATCHES_FOR_SNAPSHOT = `WITH RECURSIVE lineage AS (
    SELECT patch_id, 0 AS depth
    FROM patches
    WHERE entity_id = ? AND entity_type = ? AND parent_id IS NULL
    UNION ALL
    SELECT p.patch_id, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
    WHERE p.entity_id = ? AND p.entity_type = ?
)
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
       p.created_at, p.recorded_at, p.parent_id
FROM patches p
JOIN lineage l ON p.patch_id = l.patch_id
WHERE p.entity_id = ? AND p.entity_type = ?
ORDER BY l.depth ASC, p.patch_id ASC`;

const UPSERT_SNAPSHOT = `INSERT INTO snapshots (entity_id, entity_type, attributes)
VALUES (?, ?, CAST(? AS jsonb))
ON CONFLICT (entity_id, entity_type) DO UPDATE SET attributes = EXCLUDED.attributes`;

function rowAttributesText(row: PatchRow | SnapshotRow): string {
  const a = row.attributes;
  if (typeof a === 'string') return a;
  return JSON.stringify(a);
}

function toPatchRow(row: PatchRow): PatchRow {
  return { ...row, attributes: rowAttributesText(row) };
}

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
    patch: PatchInput,
    parentId: string | null,
    now: string,
    recordedAt: string
  ): Promise<Patch> {
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
        const written = await this.insertPatchRow(
          tx,
          patch,
          parentId,
          now,
          recordedAt
        );
        writtenPatches.push(written);
        touchedEntities.add(`${patch.entityId}\0${patch.entityType}`);
      }
      await this.recomputeTouchedSnapshots(tx, touchedEntities);
    });
    return writtenPatches;
  }

  private async batchFetchSnapshots(entityKeys: string[]): Promise<Entity[]> {
    if (entityKeys.length === 0) return [];
    const pairs: [string, string][] = entityKeys.map((key) => {
      const parts = key.split('\0');
      assert.ok(
        parts.length === 2,
        'Entity key must contain exactly one null separator',
        { key }
      );
      const entityId = parts[0];
      const entityType = parts[1];
      assert.defined(entityId, 'entityId must be defined');
      assert.defined(entityType, 'entityType must be defined');
      return [entityId, entityType] as [string, string];
    });
    const placeholders = pairs.map(() => '(?, ?)').join(', ');
    const params = pairs.flatMap(([id, type]) => [id, type]);
    const rows = await this.sqlClient.query<SnapshotRow>(
      `SELECT entity_id, entity_type, attributes::text AS attributes FROM snapshots WHERE (entity_id, entity_type) IN (VALUES ${placeholders})`,
      params
    );
    const map = new Map<string, SnapshotRow>();
    for (const row of rows) {
      map.set(`${row.entity_id}\0${row.entity_type}`, row);
    }
    const entities: Entity[] = [];
    for (const key of entityKeys) {
      const row = map.get(key);
      if (row) {
        entities.push(toEntity({ ...row, attributes: rowAttributesText(row) }));
      }
    }
    return entities;
  }

  private async batchFetchPatchesForEntities(
    entities: readonly { entity_id: string; entity_type: string }[]
  ): Promise<Patch[]> {
    if (entities.length === 0) return [];
    const placeholders = entities.map(() => '(?, ?)').join(', ');
    const params = entities.flatMap((r) => [r.entity_id, r.entity_type]);
    const patchRows = await this.sqlClient.query<PatchRow>(
      `WITH RECURSIVE lineage AS (
          SELECT patch_id, entity_id, entity_type, 0 AS depth
          FROM patches
          WHERE (entity_id, entity_type) IN (VALUES ${placeholders})
            AND parent_id IS NULL
          UNION ALL
          SELECT p.patch_id, p.entity_id, p.entity_type, l.depth + 1
          FROM patches p
          JOIN lineage l ON p.parent_id = l.patch_id
            AND p.entity_id = l.entity_id
            AND p.entity_type = l.entity_type
      )
      SELECT p.patch_id, p.entity_id, p.entity_type,
             p.attributes::text AS attributes,
             p.created_at, p.recorded_at, p.parent_id
      FROM patches p
      JOIN lineage l ON p.patch_id = l.patch_id
      ORDER BY p.entity_id, p.entity_type, l.depth ASC, p.patch_id ASC`,
      params
    );
    return patchRows.map((r) => toPatch(toPatchRow(r)));
  }

  async read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    if (queries.length === 0) return [];
    return Promise.all(queries.map((q) => this.readOne(q)));
  }

  private async readOne(query: PatchesDbQuery): Promise<PatchesDbResult> {
    const isSingleEntityQuery = typeof query.entityId === 'string';
    if (query.on === 'patches') {
      return this.readOnePatchesMode(query);
    }
    const usePatchBasedLogic =
      (query.after !== null && query.after !== undefined) ||
      isSingleEntityQuery;
    if (usePatchBasedLogic) {
      return this.readOnePatchBased(query);
    }
    return this.readOneSnapshotBased(query);
  }

  private async readOnePatchesMode(
    query: PatchesDbQuery
  ): Promise<PatchesDbResult> {
    const { conditions, params } = buildPatchConditions(query, 'p');
    const whereSQL = conditions.join(' AND ');

    const orderSQL = buildOrderSQL(query, 'ORDER BY p.patch_id ASC', 'p.');
    const limit = buildLimitSQL(query);

    const rows = await this.sqlClient.query<
      PatchRow & { total_count: string | number }
    >(
      `SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
              p.created_at, p.recorded_at, p.parent_id, COUNT(*) OVER() AS total_count
       FROM patches p WHERE ${whereSQL} ${orderSQL}${limit.sql}`,
      [...params, ...limit.params]
    );

    const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0;
    const patches = rows.map((r) => toPatch(toPatchRow(r)));
    const hasMore =
      query.limit !== null && query.limit !== undefined
        ? (query.offset ?? 0) + patches.length < total
        : false;
    const lastPatch = patches[patches.length - 1];
    const nextCursor =
      lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;

    const entityKeysOrdered: string[] = [];
    const entityKeysSeen = new Set<string>();
    for (const p of patches) {
      const key = `${p.entityId}\0${p.entityType}`;
      if (!entityKeysSeen.has(key)) {
        entityKeysSeen.add(key);
        entityKeysOrdered.push(key);
      }
    }
    const entities = await this.batchFetchSnapshots(entityKeysOrdered);

    return {
      query,
      entities,
      patches,
      total,
      hasMore,
      nextCursor,
    };
  }

  private async readOnePatchBased(
    query: PatchesDbQuery
  ): Promise<PatchesDbResult> {
    const { conditions: snapConditions, params: snapParams } =
      buildSnapshotConditions(query);
    const snapWhereSQL = snapConditions.join(' AND ');

    const hasSnapshotFilter = query.where !== null && query.where !== undefined;

    let patchConditions: string[] = [];
    let patchParams: unknown[] = [];

    if (hasSnapshotFilter) {
      if (query.entityType !== null && query.entityType !== undefined) {
        patchConditions = [
          `p.entity_id IN (SELECT s.entity_id FROM snapshots s WHERE ${snapWhereSQL})`,
          'p.entity_type = ?',
        ];
        patchParams = [...snapParams, query.entityType];
      } else {
        patchConditions = [
          `(p.entity_id, p.entity_type) IN (SELECT s.entity_id, s.entity_type FROM snapshots s WHERE ${snapWhereSQL})`,
        ];
        patchParams = [...snapParams];
      }
    } else {
      if (query.entityType !== null && query.entityType !== undefined) {
        patchConditions.push('p.entity_type = ?');
        patchParams.push(query.entityType);
      }
      if (query.entityId !== null && query.entityId !== undefined) {
        if (Array.isArray(query.entityId)) {
          const placeholders = query.entityId.map(() => '?').join(', ');
          patchConditions.push(`p.entity_id IN (${placeholders})`);
          patchParams.push(...query.entityId);
        } else {
          patchConditions.push('p.entity_id = ?');
          patchParams.push(query.entityId);
        }
      }
    }

    if (patchConditions.length === 0) {
      patchConditions.push('1=1');
    }

    let cursorCondition = '';
    const cursorParams: unknown[] = [];
    if (query.after) {
      const cursorRows = await this.sqlClient.query<{
        entity_id: string;
        entity_type: string;
        patch_id: string;
      }>(
        'SELECT entity_id, entity_type, patch_id FROM patches WHERE patch_id = ?',
        [query.after]
      );
      assert.ok(cursorRows.length > 0, 'Cursor patch not found', {
        after: query.after,
      });
      const c = cursorRows[0];
      assert.ok(c !== null && c !== undefined, 'cursorRows[0] must exist', {
        after: query.after,
      });
      const depthRows = await this.sqlClient.query<{ depth: number }>(
        `WITH RECURSIVE path AS (
                        SELECT patch_id, parent_id, 1 AS len FROM patches WHERE patch_id = ?
                        UNION ALL
                        SELECT p.patch_id, p.parent_id, ptr.len + 1 FROM patches p JOIN path ptr ON p.patch_id = ptr.parent_id
                    )
                    SELECT (max(len) - 1)::int AS depth FROM path`,
        [query.after]
      );
      const cursorDepth = depthRows[0]?.depth ?? 0;
      cursorCondition =
        ' AND (p.entity_id, p.entity_type, l.depth, p.patch_id) > (?, ?, ?, ?)';
      cursorParams.push(c.entity_id, c.entity_type, cursorDepth, c.patch_id);
    }

    const patchWhereSQL = patchConditions.join(' AND ');

    const lineageCte = `WITH RECURSIVE lineage AS (
            SELECT patch_id, entity_id, entity_type, 0 AS depth
            FROM patches
            WHERE parent_id IS NULL
            UNION ALL
            SELECT p.patch_id, p.entity_id, p.entity_type, l.depth + 1
            FROM patches p
            JOIN lineage l ON p.parent_id = l.patch_id AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
        )`;

    const countRows = await this.sqlClient.query<{ cnt: string | number }>(
      `SELECT COUNT(*)::bigint AS cnt FROM patches p WHERE ${patchWhereSQL}`,
      patchParams
    );
    const rawTotal = countRows[0]?.cnt ?? 0;
    const total =
      typeof rawTotal === 'bigint' ? Number(rawTotal) : Number(rawTotal);

    const defaultOrder =
      'ORDER BY p.entity_id ASC, p.entity_type ASC, l.depth ASC, p.patch_id ASC';
    const orderSQL = buildOrderSQL(query, defaultOrder, 'p.');
    const limit = buildLimitSQL(query);

    const selectSql = `${lineageCte} SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
            p.created_at, p.recorded_at, p.parent_id FROM patches p JOIN lineage l ON p.patch_id = l.patch_id AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type WHERE ${patchWhereSQL}${cursorCondition} ${orderSQL}${limit.sql}`;

    const rows = await this.sqlClient.query<PatchRow>(selectSql, [
      ...patchParams,
      ...cursorParams,
      ...limit.params,
    ]);

    const patches = rows.map((r) => toPatch(toPatchRow(r)));
    const hasMore =
      query.after !== null && query.after !== undefined
        ? query.limit !== null &&
          query.limit !== undefined &&
          patches.length >= query.limit
        : query.limit !== null && query.limit !== undefined
          ? (query.offset ?? 0) + patches.length < total
          : false;
    const lastPatch = patches[patches.length - 1];
    const nextCursor =
      lastPatch !== null && lastPatch !== undefined ? lastPatch.patchId : null;

    const entityKeysOrdered: string[] = [];
    const entityKeysSeen = new Set<string>();
    for (const p of patches) {
      const key = `${p.entityId}\0${p.entityType}`;
      if (!entityKeysSeen.has(key)) {
        entityKeysSeen.add(key);
        entityKeysOrdered.push(key);
      }
    }
    const entities = await this.batchFetchSnapshots(entityKeysOrdered);

    return { query, entities, patches, total, hasMore, nextCursor };
  }

  private async readOneSnapshotBased(
    query: PatchesDbQuery
  ): Promise<PatchesDbResult> {
    const { conditions, params } = buildSnapshotConditions(query);
    const whereSQL = conditions.join(' AND ');

    const orderSQL = buildOrderSQL(query, 'ORDER BY entity_id ASC');
    const limit = buildLimitSQL(query);

    const rows = await this.sqlClient.query<
      SnapshotRow & { total_count: string | number }
    >(
      `SELECT entity_id, entity_type, attributes::text AS attributes, COUNT(*) OVER() AS total_count FROM snapshots WHERE ${whereSQL} ${orderSQL}${limit.sql}`,
      [...params, ...limit.params]
    );

    const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0;
    const entities = rows.map((r) =>
      toEntity({ ...r, attributes: rowAttributesText(r) })
    );
    const hasMore =
      query.limit !== null && query.limit !== undefined
        ? (query.offset ?? 0) + entities.length < total
        : false;

    const patches = await this.batchFetchPatchesForEntities(rows);

    return {
      query,
      entities,
      patches,
      total,
      hasMore,
      nextCursor: null,
    };
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
