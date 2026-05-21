export const DELETE_SNAPSHOT = `DELETE FROM snapshots
WHERE entity_id = ? AND entity_type = ?`;

// `?::text::jsonb` (rather than `CAST(? AS jsonb)`) is intentional. Bun's
// `bun:sql` Postgres driver runs `jsonStringifyFast` on every parameter
// whose resolved PG type is `json`/`jsonb`, double-encoding values that
// were already `JSON.stringify`'d by the caller. Casting the parameter
// to `text` first pins its resolved type to `text`, so Bun sends the raw
// UTF-8 string and Postgres parses it into jsonb on the server side. The
// Neon HTTP driver (used in production by the Worker) is unaffected
// either way -- both paths see a plain text param + `text::jsonb` cast.
// See https://github.com/oven-sh/bun/issues/28819.
export const INSERT_PATCH = `INSERT INTO patches (
        patch_id,
        entity_id,
        entity_type,
        attributes,
        created_at,
        recorded_at,
        parent_id
    )
VALUES (?, ?, ?, ?::text::jsonb, ?, ?, ?)
ON CONFLICT (patch_id) DO NOTHING`;

/** Single round-trip for many rows (Neon HTTP = one subrequest per `run`). */
export const INSERT_PATCHES_BATCH = `INSERT INTO patches (
        patch_id,
        entity_id,
        entity_type,
        attributes,
        created_at,
        recorded_at,
        parent_id
    )
    SELECT
        patch_id,
        entity_id,
        entity_type,
        attributes,
        created_at,
        recorded_at,
        parent_id
    FROM jsonb_to_recordset(?::text::jsonb) AS batch_rows (
        patch_id text,
        entity_id text,
        entity_type text,
        attributes jsonb,
        created_at text,
        recorded_at text,
        parent_id text
    )
    ON CONFLICT (patch_id) DO NOTHING`;

export const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS patches (
    patch_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP::TEXT),
    parent_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_patches_entity ON patches (entity_type, entity_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_patches_roots
    ON patches (entity_type, entity_id) WHERE parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_patches_parent ON patches (parent_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS snapshots (
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_attrs_gin ON snapshots USING GIN (attributes jsonb_path_ops);
`;

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

/**
 * Batched form of {@link RESOLVE_PARENT_ID}. Takes a JSON array of
 * `{ entity_id, entity_type }` pairs and returns the leaf patch (no
 * children, reachable from the canonical `parent_id IS NULL` root) for
 * each entity that has at least one patch. Entities with no patches are
 * simply absent from the result set — the caller treats that as `null`.
 *
 * Replaces N-way `Promise.all(resolveParentId(...))` fan-outs that
 * historically saturated serverless HTTP gateways (e.g. Neon) with one
 * concurrent request per touched entity in a write batch.
 */
export const RESOLVE_PARENT_IDS_BATCH = `WITH RECURSIVE input AS (
    SELECT entity_id, entity_type
    FROM jsonb_to_recordset(?::text::jsonb) AS x (
        entity_id text,
        entity_type text
    )
),
lineage AS (
    SELECT p.entity_id, p.entity_type, p.patch_id, 0 AS depth
    FROM patches p
    JOIN input i
      ON p.entity_id = i.entity_id AND p.entity_type = i.entity_type
    WHERE p.parent_id IS NULL
    UNION ALL
    SELECT p.entity_id, p.entity_type, p.patch_id, l.depth + 1
    FROM patches p
    JOIN lineage l
      ON p.parent_id = l.patch_id
     AND p.entity_id = l.entity_id
     AND p.entity_type = l.entity_type
    WHERE (p.entity_id, p.entity_type) IN (SELECT entity_id, entity_type FROM input)
)
SELECT DISTINCT ON (l.entity_id, l.entity_type)
       l.entity_id, l.entity_type, l.patch_id
FROM lineage l
WHERE NOT EXISTS (
    SELECT 1 FROM patches c
    WHERE c.parent_id = l.patch_id
      AND c.entity_id = l.entity_id
      AND c.entity_type = l.entity_type
)
ORDER BY l.entity_id, l.entity_type, l.depth DESC, l.patch_id ASC`;

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
SELECT p.patch_id, p.entity_id, p.entity_type, p.attributes::text AS attributes,
       p.created_at, p.recorded_at, p.parent_id
FROM patches p
JOIN lineage l ON p.patch_id = l.patch_id
WHERE p.entity_id = ? AND p.entity_type = ?
ORDER BY l.depth ASC, p.patch_id ASC`;

export const UPSERT_SNAPSHOT = `INSERT INTO snapshots (entity_id, entity_type, attributes)
VALUES (?, ?, ?::text::jsonb)
ON CONFLICT (entity_type, entity_id) DO UPDATE SET attributes = EXCLUDED.attributes`;

/** One round-trip to upsert many snapshot rows (Neon HTTP = one subrequest per `run`). */
export const UPSERT_SNAPSHOTS_BATCH = `INSERT INTO snapshots (entity_id, entity_type, attributes)
    SELECT entity_id, entity_type, attributes
    FROM jsonb_to_recordset(?::text::jsonb) AS batch_rows (
        entity_id text,
        entity_type text,
        attributes jsonb
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET attributes = EXCLUDED.attributes`;

export const SELECT_DEPTH_BY_PATCH_ID = `WITH RECURSIVE path AS (
                        SELECT patch_id, parent_id, 1 AS len FROM patches WHERE patch_id = ?
                        UNION ALL
                        SELECT p.patch_id, p.parent_id, ptr.len + 1 FROM patches p JOIN path ptr ON p.patch_id = ptr.parent_id
                    )
                    SELECT (max(len) - 1)::int AS depth FROM path`;
