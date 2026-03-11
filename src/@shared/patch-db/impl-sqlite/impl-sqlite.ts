import { SqlClient } from '../../sql-client/interface';
import {
  Entity,
  Patch,
  PatchInput,
  PatchesDbQuery,
  PatchesDbResult,
  SyncStatePatchesDb,
} from '../interface';
import { toEntity, toMetadata, toPatch } from './mappers';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildSnapshotConditions,
} from './query-builder';
import type { PatchRow, SnapshotRow } from './types';

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
        parent_id,
        metadata
    )
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

const migrations = `CREATE TABLE IF NOT EXISTS patches (
    patch_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    attributes TEXT NOT NULL DEFAULT('{}'),
    created_at TEXT NOT NULL,
    recorded_at TEXT DEFAULT(datetime('now')) NOT NULL,
    parent_id TEXT REFERENCES patches (patch_id),
    metadata TEXT NOT NULL DEFAULT '{}'
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

const selectUnsyncedPatches = `WITH RECURSIVE lineage AS (
    SELECT patch_id, entity_id, entity_type, 0 AS depth
    FROM patches
    WHERE parent_id IS NULL
    UNION ALL
    SELECT p.patch_id, p.entity_id, p.entity_type, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
)
SELECT p.* FROM patches p
JOIN lineage l ON p.patch_id = l.patch_id AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
WHERE json_extract(p.metadata, '$.syncedAt') IS NULL
ORDER BY p.entity_id ASC, p.entity_type ASC, l.depth ASC, p.patch_id ASC`;

export class PatchDbImplSqlite implements SyncStatePatchesDb {
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
    return rows.length > 0 ? rows[0].patch_id : null;
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
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
        await tx.run(insertPatch, [
          patchId,
          patch.entityId,
          patch.entityType,
          JSON.stringify(patch.attributes),
          now,
          recordedAt,
          parentId,
          toMetadata(patch),
        ]);
        const meta = patch.meta ?? {};
        result.push({
          ...patch,
          patchId,
          parentId,
          createdAt: now,
          recordedAt,
          createdBy: String(meta.createdBy ?? ''),
          sessionId: meta.sessionId != null ? String(meta.sessionId) : '',
        });
        touchedEntities.add(`${patch.entityId}\0${patch.entityType}`);
      }

      for (const key of touchedEntities) {
        const [entityId, entityType] = key.split('\0');
        await this.recomputeSnapshot(tx, entityId, entityType);
      }
    });
    return result;
  }

  async readPatches(
    queries: PatchesDbQuery[]
  ): Promise<PatchesDbResult<Patch>[]> {
    if (queries.length === 0) return [];
    return Promise.all(queries.map((q) => this.patchesOne(q)));
  }

  private async patchesOne(
    query: PatchesDbQuery
  ): Promise<PatchesDbResult<Patch>> {
    const { conditions: snapConditions, params: snapParams } =
      buildSnapshotConditions(query);
    const snapWhereSQL = snapConditions.join(' AND ');

    const hasSnapshotFilter = query.where != null;

    let patchConditions: string[];
    let patchParams: unknown[];

    if (hasSnapshotFilter) {
      patchConditions = [
        `p.entity_id IN (SELECT s.entity_id FROM snapshots s WHERE ${snapWhereSQL})`,
      ];
      patchParams = [...snapParams];
      patchConditions.push('p.entity_type = ?');
      patchParams.push(query.entityType);
    } else {
      patchConditions = ['p.entity_type = ?'];
      patchParams = [query.entityType];
      if (query.entityId != null) {
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
      if (cursorRows.length > 0) {
        const c = cursorRows[0];
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

    const data = rows.map(toPatch);
    const hasMore =
      query.after != null
        ? query.limit != null && data.length >= query.limit
        : query.limit != null
          ? (query.offset ?? 0) + data.length < total
          : false;
    const nextCursor = data.length > 0 ? data[data.length - 1].patchId : null;

    return { data, total, hasMore, nextCursor };
  }

  async readEntities(
    queries: PatchesDbQuery[]
  ): Promise<PatchesDbResult<Entity>[]> {
    if (queries.length === 0) return [];
    return Promise.all(queries.map((q) => this.entitiesOne(q)));
  }

  private async entitiesOne(
    query: PatchesDbQuery
  ): Promise<PatchesDbResult<Entity>> {
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
      query.limit != null ? (query.offset ?? 0) + data.length < total : false;

    return { data, total, hasMore, nextCursor: null };
  }

  async getUnsyncedPatches(): Promise<Patch[]> {
    const rows = await this.sqlClient.query<PatchRow>(
      selectUnsyncedPatches,
      []
    );
    return rows.map(toPatch);
  }

  async markPatchesSynced(patchIds: string[]): Promise<void> {
    if (patchIds.length === 0) return;
    const placeholders = patchIds.map(() => '?').join(', ');
    await this.sqlClient.run(
      `UPDATE patches SET metadata = json_set(metadata, '$.syncedAt', ?) WHERE patch_id IN (${placeholders})`,
      ['1', ...patchIds]
    );
  }
}
