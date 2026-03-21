import { assert, assertDefined } from '../../assert';
import { SqlClient } from '../../sql-client/interface';
import {
  assertAttribute,
  Entity,
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import { toEntity, toPatch } from './mappers';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
} from './query-builder';
import type { PatchRow, SnapshotRow } from './types';

const PATCH_META_KEYS = [
  'patch/createdBy',
  'patch/sessionId',
  'patch/syncedAt',
];

const deleteSnapshot = `DELETE FROM snapshots
WHERE entity_id = ? AND entity_type = ?`;

const insertPatch = `INSERT OR IGNORE INTO
    patches (
        patch_id,
        entity_id,
        entity_type,
        attributes,
        created_at,
        recorded_at,
        parent_id
    )
VALUES (?, ?, ?, ?, ?, ?, ?)`;

const migrations = `CREATE TABLE IF NOT EXISTS patches (
    patch_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    attributes TEXT NOT NULL DEFAULT('{}'),
    created_at TEXT NOT NULL,
    recorded_at TEXT DEFAULT(datetime('now')) NOT NULL,
    parent_id TEXT REFERENCES patches (patch_id)
);

CREATE INDEX IF NOT EXISTS idx_patches_entity_id ON patches (entity_id);

CREATE INDEX IF NOT EXISTS idx_patches_parent_id ON patches (parent_id);

CREATE TABLE IF NOT EXISTS snapshots (
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    attributes TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (entity_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_entity_type ON snapshots (entity_type);`;

const resolveParentIdSql = `WITH RECURSIVE lineage AS (
    SELECT patch_id, 0 AS depth
    FROM patches
    WHERE entity_id = ? AND entity_type = ? AND parent_id IS NULL
    UNION ALL
    SELECT p.patch_id, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
    WHERE p.entity_id = ? AND entity_type = ?
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

const selectPatchesForSnapshot = `WITH RECURSIVE lineage AS (
    SELECT patch_id, 0 AS depth
    FROM patches
    WHERE entity_id = ? AND entity_type = ? AND parent_id IS NULL
    UNION ALL
    SELECT p.patch_id, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
    WHERE p.entity_id = ? AND entity_type = ?
)
SELECT p.* FROM patches p
JOIN lineage l ON p.patch_id = l.patch_id
WHERE p.entity_id = ? AND p.entity_type = ?
ORDER BY l.depth ASC, p.patch_id ASC`;

const upsertSnapshot = `INSERT INTO snapshots (entity_id, entity_type, attributes)
VALUES (?, ?, ?)
ON CONFLICT (entity_id, entity_type) DO UPDATE SET attributes = excluded.attributes`;

export class PatchDbImplSqlite implements PatchesDb {
  constructor(private sqlClient: SqlClient) {}

  async migrate(): Promise<void> {
    const statements = migrations
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await this.sqlClient.run(stmt);
    }
    try {
      await this.sqlClient.run('ALTER TABLE patches DROP COLUMN lineage_depth');
    } catch {
      // Column may not exist (new DB or already dropped)
    }
    try {
      await this.sqlClient.run(
        'DROP INDEX IF EXISTS idx_patches_entity_type_lineage'
      );
    } catch {
      // Index may not exist
    }
    try {
      const tableInfo = await this.sqlClient.query<{ name: string }>(
        "SELECT name FROM pragma_table_info('patches') WHERE name = 'metadata'"
      );
      if (tableInfo.length > 0) {
        await this.sqlClient.run(`UPDATE patches SET attributes = json_set(
          attributes,
          '$.patch/createdBy', coalesce(json_extract(metadata, '$.createdBy'), ''),
          '$.patch/sessionId', coalesce(json_extract(metadata, '$.sessionId'), ''),
          '$.patch/syncedAt', json_extract(metadata, '$.syncedAt')
        )`);
        await this.sqlClient.run('ALTER TABLE patches DROP COLUMN metadata');
      }
    } catch {
      // Column may not exist (new DB) or already dropped
    }
  }

  private async recomputeSnapshot(
    tx: SqlClient,
    entityId: string,
    entityType: string
  ): Promise<void> {
    const rows = await tx.query<PatchRow>(selectPatchesForSnapshot, [
      entityId,
      entityType,
      entityId,
      entityType,
      entityId,
      entityType,
    ]);

    const merged: Record<string, unknown> = {};
    for (const row of rows) {
      const attrs = JSON.parse(row.attributes) as Record<string, unknown>;
      for (const [key, value] of Object.entries(attrs)) {
        if (PATCH_META_KEYS.includes(key)) continue;
        if (value === null) {
          delete merged[key];
        } else {
          merged[key] = value;
        }
      }
    }

    if (Object.keys(merged).length === 0) {
      await tx.run(deleteSnapshot, [entityId, entityType]);
    } else {
      await tx.run(upsertSnapshot, [
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
    const rows = await tx.query<{ patch_id: string }>(resolveParentIdSql, [
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

  async write(patches: PatchInput[]): Promise<Patch[]> {
    for (const patch of patches) {
      for (const key of Object.keys(patch.attributes)) {
        assertAttribute(key);
      }
    }
    assert(patches.length > 0, 'patches must not be empty');

    if (patches.length === 0) return [];
    const result: Patch[] = [];
    await this.sqlClient.transaction(async (tx) => {
      const touchedEntities = new Set<string>();
      let lastTimestamp = Date.now() - 1;
      for (const patch of patches) {
        const patchId =
          'patchId' in patch && typeof patch.patchId === 'string'
            ? patch.patchId
            : crypto.randomUUID();
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
        const createdByVal =
          ('createdBy' in patch
            ? patch.createdBy
            : patch.attributes['patch/createdBy']) ?? '';
        const sessionIdVal =
          'sessionId' in patch
            ? patch.sessionId
            : patch.attributes['patch/sessionId'];
        const createdBy = String(createdByVal);
        const sessionId =
          sessionIdVal !== null && sessionIdVal !== undefined
            ? String(sessionIdVal)
            : '';
        const syncedAt = patch.attributes['patch/syncedAt'] ?? null;
        for (const key of Object.keys(patch.attributes)) {
          assertAttribute(key);
        }
        const storedAttributes = {
          ...patch.attributes,
          'patch/createdBy': createdBy,
          'patch/sessionId': sessionId,
          'patch/syncedAt': syncedAt,
        };
        await tx.run(insertPatch, [
          patchId,
          patch.entityId,
          patch.entityType,
          JSON.stringify(storedAttributes),
          now,
          recordedAt,
          parentId,
        ]);
        result.push({
          ...patch,
          patchId,
          parentId,
          createdAt: now,
          recordedAt,
          createdBy,
          sessionId,
        });
        touchedEntities.add(`${patch.entityId}\0${patch.entityType}`);
      }

      for (const key of touchedEntities) {
        const parts = key.split('\0');
        assert(
          parts.length === 2,
          'Entity key must contain exactly one null separator',
          { key }
        );
        const entityId = parts[0];
        assertDefined(
          entityId,
          'Entity key must contain exactly one null separator'
        );
        const entityType = parts[1];
        assertDefined(
          entityType,
          'Entity key must contain exactly one null separator'
        );
        await this.recomputeSnapshot(tx, entityId, entityType);
      }
    });
    return result;
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

    const countRows = await this.sqlClient.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM patches p WHERE ${whereSQL}`,
      params
    );
    const total = countRows[0]?.cnt ?? 0;

    const orderSQL = buildOrderSQL(query, 'ORDER BY p.patch_id ASC', 'p.');
    const limit = buildLimitSQL(query);

    const rows = await this.sqlClient.query<PatchRow>(
      `SELECT * FROM patches p WHERE ${whereSQL} ${orderSQL}${limit.sql}`,
      [...params, ...limit.params]
    );

    const patches = rows.map(toPatch);
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
    const data: Entity[] = [];
    for (const key of entityKeysOrdered) {
      const parts = key.split('\0');
      assert(
        parts.length === 2,
        'Entity key must contain exactly one null separator',
        { key }
      );
      const entityId = parts[0];
      const entityType = parts[1];
      assert(
        entityId !== null &&
          entityId !== undefined &&
          entityType !== null &&
          entityType !== undefined,
        'parts must have 2 elements',
        { key }
      );
      const snapRows = await this.sqlClient.query<SnapshotRow>(
        'SELECT * FROM snapshots WHERE entity_id = ? AND entity_type = ?',
        [entityId, entityType]
      );
      const snapRow = snapRows[0];
      if (snapRow !== null && snapRow !== undefined) {
        data.push(toEntity(snapRow));
      }
    }

    return {
      query,
      entities: data,
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
      assert(cursorRows.length > 0, 'Cursor patch not found', {
        after: query.after,
      });
      const c = cursorRows[0];
      assert(c !== null && c !== undefined, 'cursorRows[0] must exist', {
        after: query.after,
      });
      const depthRows = await this.sqlClient.query<{ depth: number }>(
        `WITH RECURSIVE path AS (
                        SELECT patch_id, parent_id, 1 AS len FROM patches WHERE patch_id = ?
                        UNION ALL
                        SELECT p.patch_id, p.parent_id, ptr.len + 1 FROM patches p JOIN path ptr ON p.patch_id = ptr.parent_id
                    )
                    SELECT max(len) - 1 AS depth FROM path`,
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

    const countRows = await this.sqlClient.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM patches p WHERE ${patchWhereSQL}`,
      patchParams
    );
    const total = countRows[0]?.cnt ?? 0;

    const defaultOrder =
      'ORDER BY p.entity_id ASC, p.entity_type ASC, l.depth ASC, p.patch_id ASC';
    const orderSQL = buildOrderSQL(query, defaultOrder, 'p.');
    const limit = buildLimitSQL(query);

    const selectSql = `${lineageCte} SELECT p.* FROM patches p JOIN lineage l ON p.patch_id = l.patch_id AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type WHERE ${patchWhereSQL}${cursorCondition} ${orderSQL}${limit.sql}`;

    const rows = await this.sqlClient.query<PatchRow>(selectSql, [
      ...patchParams,
      ...cursorParams,
      ...limit.params,
    ]);

    const patches = rows.map(toPatch);
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
    const data: Entity[] = [];
    for (const key of entityKeysOrdered) {
      const parts = key.split('\0');
      assert(
        parts.length === 2,
        'Entity key must contain exactly one null separator',
        { key }
      );
      const entityId = parts[0];
      const entityType = parts[1];
      assert(
        entityId !== null &&
          entityId !== undefined &&
          entityType !== null &&
          entityType !== undefined,
        'parts must have 2 elements',
        { key }
      );
      const snapRows = await this.sqlClient.query<SnapshotRow>(
        'SELECT * FROM snapshots WHERE entity_id = ? AND entity_type = ?',
        [entityId, entityType]
      );
      const snapRow = snapRows[0];
      if (snapRow !== null && snapRow !== undefined) {
        data.push(toEntity(snapRow));
      }
    }

    return { query, entities: data, patches, total, hasMore, nextCursor };
  }

  private async readOneSnapshotBased(
    query: PatchesDbQuery
  ): Promise<PatchesDbResult> {
    const { conditions, params } = buildSnapshotConditions(query);
    const whereSQL = conditions.join(' AND ');

    const countRows = await this.sqlClient.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM snapshots WHERE ${whereSQL}`,
      params
    );
    const total = countRows[0]?.cnt ?? 0;

    const orderSQL = buildOrderSQL(query, 'ORDER BY entity_id ASC');
    const limit = buildLimitSQL(query);

    const rows = await this.sqlClient.query<SnapshotRow>(
      `SELECT * FROM snapshots WHERE ${whereSQL} ${orderSQL}${limit.sql}`,
      [...params, ...limit.params]
    );

    const data = rows.map(toEntity);
    const hasMore =
      query.limit !== null && query.limit !== undefined
        ? (query.offset ?? 0) + data.length < total
        : false;

    const patches: Patch[] = [];
    for (const row of rows) {
      const patchRows = await this.sqlClient.query<PatchRow>(
        selectPatchesForSnapshot,
        [
          row.entity_id,
          row.entity_type,
          row.entity_id,
          row.entity_type,
          row.entity_id,
          row.entity_type,
        ]
      );
      patches.push(...patchRows.map(toPatch));
    }

    return {
      query,
      entities: data,
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
