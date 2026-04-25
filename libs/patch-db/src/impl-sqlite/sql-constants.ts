import { assertSqliteQuery } from '@gamezilla/lib/sqlite';

export const DELETE_SNAPSHOT = `DELETE FROM snapshots
WHERE entity_id = ? AND entity_type = ?`;
assertSqliteQuery(DELETE_SNAPSHOT);

export const INSERT_PATCH = `INSERT OR IGNORE INTO
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
assertSqliteQuery(INSERT_PATCH);

export const MIGRATIONS = `CREATE TABLE IF NOT EXISTS patches (
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
assertSqliteQuery(MIGRATIONS);

export const RESOLVE_PARENT_ID = `WITH RECURSIVE lineage AS (
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
assertSqliteQuery(RESOLVE_PARENT_ID);

export const SELECT_PATCHES_FOR_SNAPSHOT = `WITH RECURSIVE lineage AS (
    SELECT patch_id, 0 AS depth
    FROM patches
    WHERE entity_id = ? AND entity_type = ? AND parent_id IS NULL
    UNION ALL
    SELECT p.patch_id, l.depth + 1
    FROM patches p
    JOIN lineage l ON p.parent_id = l.patch_id
    WHERE p.entity_id = ? AND p.entity_type = ?
)
SELECT p.* FROM patches p
JOIN lineage l ON p.patch_id = l.patch_id
WHERE p.entity_id = ? AND p.entity_type = ?
ORDER BY l.depth ASC, p.patch_id ASC`;
assertSqliteQuery(SELECT_PATCHES_FOR_SNAPSHOT);

export const UPSERT_SNAPSHOT = `INSERT INTO snapshots (entity_id, entity_type, attributes)
VALUES (?, ?, ?)
ON CONFLICT (entity_id, entity_type) DO UPDATE SET attributes = excluded.attributes`;
assertSqliteQuery(UPSERT_SNAPSHOT);

export const LINEAGE_CTE = `WITH RECURSIVE lineage AS (
            SELECT patch_id, entity_id, entity_type, 0 AS depth
            FROM patches
            WHERE parent_id IS NULL
            UNION ALL
            SELECT p.patch_id, p.entity_id, p.entity_type, l.depth + 1
            FROM patches p
            JOIN lineage l ON p.parent_id = l.patch_id AND p.entity_id = l.entity_id AND p.entity_type = l.entity_type
        )`;

export const SELECT_DEPTH_BY_PATCH_ID = `WITH RECURSIVE path AS (
                        SELECT patch_id, parent_id, 1 AS len FROM patches WHERE patch_id = ?
                        UNION ALL
                        SELECT p.patch_id, p.parent_id, ptr.len + 1 FROM patches p JOIN path ptr ON p.patch_id = ptr.parent_id
                    )
                    SELECT max(len) - 1 AS depth FROM path`;
