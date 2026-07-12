/**
 * Pure SQL strings for {@link migrate}. Split out so `migrate.ts` stays
 * focused on orchestration (idempotency checks, fingerprint compare,
 * sequencing) and the file-size cap stays comfortable.
 *
 * Schema v3 layout (chess.com-scale):
 *   - `matchmaking_waiting` — UNLOGGED, PARTITION BY HASH(partition_signature)
 *     across 16 children. Hot waiting set; no WAL writes; per-partition
 *     autovacuum; index size and lock pages divide by 16.
 *   - `matchmaking_matched` — LOGGED single table holding the small,
 *     short-lived tail of paired rows the `/status` poll can still
 *     read. Sweep is row-level DELETE on `matched_at`.
 *   - `matchmaking_active_partitions` — UNLOGGED helper: every join
 *     UPSERTs its signature so `discoverActivePartitions` can read a
 *     tiny index scan instead of `SELECT DISTINCT` over the hot table.
 *
 * Throttle plumbing is gone. The host-owned scheduler (Durable Object
 * alarm) is the sole caller of `runMatchPass` / `sweep_*`, and is
 * self-throttled by its alarm cadence.
 *
 * Nothing here knows about the caller-declared `MatchmakingSchema` —
 * schema-dependent DDL (generated column expressions) is built in
 * `migrate.ts` from helper functions there.
 */

export const NUM_WAITING_PARTITIONS = 16;

// Caller-shape state tracking — lets `migrate()` decide whether the
// generated columns + indexes need to be rebuilt without touching
// pg_attrdef directly (Postgres normalises expressions, so a textual
// compare against `pg_get_expr` is unreliable). The fingerprint carries
// SCHEMA_VERSION so any structural bump triggers a rebuild even when the
// caller-declared schema hasn't changed.
export const CREATE_SCHEMA_STATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_schema_state (
  id                  INT PRIMARY KEY,
  schema_fingerprint  TEXT NOT NULL
)
`.trim();

// Drop active partitions ahead of a waiting-table rebuild when the PK
// shape changes (v4 added `group_size`). CREATE below picks up the new
// PK rather than colliding with an older single-column PK.
export const DROP_ACTIVE_PARTITIONS_SQL = `
DROP TABLE IF EXISTS matchmaking_active_partitions CASCADE
`.trim();

// Helper table — see file-level doc. UNLOGGED because the side table is
// regenerated on every join; if it goes missing on crash, the next
// `/join` re-creates the entry. Per-(signature, group_size) writes are
// O(1). The composite PK is what lets the tick loop drive distinct
// (sig, group_size) pairs without scanning the waiting table.
export const CREATE_ACTIVE_PARTITIONS_TABLE_SQL = `
CREATE UNLOGGED TABLE IF NOT EXISTS matchmaking_active_partitions (
  partition_signature TEXT NOT NULL,
  group_size          INT  NOT NULL DEFAULT 2,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (partition_signature, group_size)
)
`.trim();

// Matched-rows table. LOGGED (these are the only durable matchmaking
// rows — a server crash must not lose paired-but-not-yet-polled match
// state). PRIMARY KEY (id) for status() lookups; index on match_id for
// peer fetch; index on matched_at for sweep.
//
// v5 adds `metadata JSONB NULL` so the caller-supplied payload survives
// pairing and is observable via `status()`.
export const CREATE_MATCHED_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_matched (
  id          UUID    PRIMARY KEY,
  match_id    UUID    NOT NULL,
  joined_at   TIMESTAMPTZ NOT NULL,
  matched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  data        JSONB   NOT NULL,
  metadata    JSONB   NULL
)
`.trim();

/**
 * v5 idempotency helper: an existing v4 install has a `matchmaking_matched`
 * table without the `metadata` column. The waiting-table rebuild
 * dropped/recreated `matchmaking_waiting` so we don't need this for it,
 * but `matchmaking_matched` is LOGGED (durable) and we don't want to
 * drop matched rows on every schema bump — add the column in place.
 */
export const ADD_METADATA_COLUMN_TO_MATCHED_SQL = `
ALTER TABLE matchmaking_matched ADD COLUMN IF NOT EXISTS metadata JSONB NULL
`.trim();

export const CREATE_MATCHED_MATCH_ID_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_matched_match_id_idx
  ON matchmaking_matched (match_id)
`.trim();

export const CREATE_MATCHED_MATCHED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_matched_matched_at_idx
  ON matchmaking_matched (matched_at)
`.trim();

// Builds the `CREATE TABLE matchmaking_waiting` DDL.
//
// `partition_signature` is a REGULAR column (not generated). Postgres
// forbids generated columns as partition keys ("cannot use generated
// column in partition key"), so the JS caller computes the signature
// from `data` via `Matchmaker.partitionSignatureFor()` and threads it
// into the INSERT explicitly. The byte-for-byte equivalence between
// the JS computation and the canonical SQL expression is preserved
// because both are derived from {@link MatchmakingSchema}.
//
// `primary_rating` and `primary_bucket` remain stored generated columns
// — they are NOT partition keys, just bucket-pre-filter helpers, and
// derive cheaply from `data->>primaryNumericKey`.
//
// Top-level table is UNLOGGED + PARTITION BY HASH; child partitions
// inherit the unlogged flag automatically.
/**
 * v4: adds `group_size INT NOT NULL DEFAULT 2 CHECK (group_size BETWEEN
 * 2 AND 16)` so callers can request 3-, 4-, ..., 16-way matches without
 * a schema change per group size. group_size = 2 is the regression path
 * and stays bit-for-bit compatible with v3 behaviour for unspecified
 * joins. The CHECK constraint is the hard ceiling — even if a caller
 * bypasses JS validation and INSERTs directly, Postgres rejects.
 */
export const MATCHMAKING_MIN_GROUP_SIZE = 2;
export const MATCHMAKING_MAX_GROUP_SIZE = 16;

/**
 * v5 priority bounds: hard-clamped to [-1000, 1000] both at the JS
 * validator AND at the SQL CHECK constraint. Lets callers surface VIPs
 * or retry attempts without unbounded queue-jumping abuse.
 */
export const MATCHMAKING_MIN_PRIORITY = -1000;
export const MATCHMAKING_MAX_PRIORITY = 1000;

export function buildCreateWaitingTableSql(parts: {
  readonly primaryRatingExpr: string;
  readonly primaryBucketExpr: string;
}): string {
  return `
CREATE UNLOGGED TABLE IF NOT EXISTS matchmaking_waiting (
  id                  UUID    NOT NULL DEFAULT gen_random_uuid(),
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  data                JSONB   NOT NULL DEFAULT '{}',
  formulas            JSONB   NOT NULL DEFAULT '[]',
  partition_signature TEXT    NOT NULL,
  group_size          INT     NOT NULL DEFAULT ${String(MATCHMAKING_MIN_GROUP_SIZE)}
                              CHECK (group_size BETWEEN ${String(MATCHMAKING_MIN_GROUP_SIZE)} AND ${String(MATCHMAKING_MAX_GROUP_SIZE)}),
  priority            INT     NOT NULL DEFAULT 0
                              CHECK (priority BETWEEN ${String(MATCHMAKING_MIN_PRIORITY)} AND ${String(MATCHMAKING_MAX_PRIORITY)}),
  metadata            JSONB   NULL,
  primary_rating      NUMERIC GENERATED ALWAYS AS (${parts.primaryRatingExpr}) STORED,
  primary_bucket      INT     GENERATED ALWAYS AS (${parts.primaryBucketExpr}) STORED,
  PRIMARY KEY (id, partition_signature)
) PARTITION BY HASH (partition_signature)
`.trim();
}

export function buildCreateWaitingChildSql(remainder: number): string {
  const suffix = remainder.toString().padStart(2, '0');
  return `
CREATE UNLOGGED TABLE IF NOT EXISTS matchmaking_waiting_p${suffix}
  PARTITION OF matchmaking_waiting
  FOR VALUES WITH (MODULUS ${String(NUM_WAITING_PARTITIONS)}, REMAINDER ${String(remainder)})
  WITH (fillfactor = 80)
`.trim();
}

// Hot path index. Order: (partition_signature, group_size,
// primary_bucket, priority DESC, joined_at). The per-(sig, group_size)
// snapshot CTE walks the index in priority-then-FIFO order within the
// right bucket range without any sort step. Index lives on the parent
// and propagates to all 16 child partitions.
//
// v5 inserts `priority DESC` between `primary_bucket` and `joined_at`
// so high-priority joiners are visited first in the candidate snapshot
// — implements the documented priority semantics without a separate
// sort step.
export const CREATE_WAITING_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_waiting_partition_bucket_idx
  ON matchmaking_waiting (partition_signature, group_size, primary_bucket, priority DESC, joined_at)
`.trim();

// Drop the entire waiting table (parent + child partitions) ahead of a
// fingerprint-triggered rebuild. CASCADE handles partition children.
export const DROP_WAITING_TABLE_SQL = `
DROP TABLE IF EXISTS matchmaking_waiting CASCADE
`.trim();

/**
 * Hard-equality filter: two participants are compatible candidates only
 * when they agree on every partition attribute in the formula. Used by
 * `matchmaking_pair_match` per formula side; the schema-level
 * `partition_signature` is a coarser/cheaper pre-filter for candidate
 * selection.
 */
export const CREATE_PAIR_COMPATIBLE_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_pair_compatible(
  p_a JSONB,
  p_b JSONB,
  p_partition_terms JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $matchmaking_pair_compatible$
DECLARE
  v_term JSONB;
  v_path TEXT;
BEGIN
  IF p_partition_terms IS NULL THEN
    RETURN TRUE;
  END IF;
  FOR v_term IN SELECT * FROM jsonb_array_elements(p_partition_terms) LOOP
    v_path := v_term->>'path';
    IF (p_a->>v_path) IS DISTINCT FROM (p_b->>v_path) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$matchmaking_pair_compatible$;
`.trim();

export const CREATE_PAIR_DISTANCE_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_pair_distance(
  p_a JSONB,
  p_b JSONB,
  p_numeric_terms     JSONB,
  p_categorical_terms JSONB
) RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE
AS $matchmaking_pair_distance$
DECLARE
  v_total NUMERIC := 0;
  v_term  JSONB;
  v_path  TEXT;
  v_a_n   NUMERIC;
  v_b_n   NUMERIC;
  v_a_t   TEXT;
  v_b_t   TEXT;
BEGIN
  IF p_numeric_terms IS NOT NULL THEN
    FOR v_term IN SELECT * FROM jsonb_array_elements(p_numeric_terms) LOOP
      v_path := v_term->>'path';
      v_a_n  := (p_a->>v_path)::NUMERIC;
      v_b_n  := (p_b->>v_path)::NUMERIC;
      IF v_a_n IS NULL OR v_b_n IS NULL THEN
        RAISE EXCEPTION
          'matchmaking_pair_distance: missing numeric attr %', v_path;
      END IF;
      v_total := v_total + (v_term->>'weight')::NUMERIC * ABS(v_a_n - v_b_n);
    END LOOP;
  END IF;

  IF p_categorical_terms IS NOT NULL THEN
    FOR v_term IN SELECT * FROM jsonb_array_elements(p_categorical_terms) LOOP
      v_path := v_term->>'path';
      v_a_t  := p_a->>v_path;
      v_b_t  := p_b->>v_path;
      IF v_a_t IS DISTINCT FROM v_b_t THEN
        v_total := v_total + (v_term->>'penalty')::NUMERIC;
      END IF;
    END LOOP;
  END IF;

  RETURN v_total;
END;
$matchmaking_pair_distance$;
`.trim();

/**
 * v5: per-formula radius override.
 *
 * `a_radius` / `b_radius` are the EFFECTIVE radii each side will use
 * for ANY formula that does NOT carry its own override. When a formula
 * has a `radius` JSONB key, the wait-elapsed radius for that formula is
 * computed inline from its `baseRadius / radiusGrowthPerSecond /
 * maxRadius` triple using the function-arg wait-elapsed seconds
 * (`a_wait_sec` / `b_wait_sec`).
 *
 * This keeps the global radius the default (back-compat: missing
 * `radius` field == use function-arg value) while letting individual
 * formulas declare tighter or looser bounds.
 */
export const CREATE_PAIR_MATCH_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_pair_match(
  a_data       JSONB,
  a_formulas   JSONB,
  a_radius     NUMERIC,
  a_wait_sec   NUMERIC,
  b_data       JSONB,
  b_formulas   JSONB,
  b_radius     NUMERIC,
  b_wait_sec   NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $matchmaking_pair_match$
DECLARE
  v_fa     JSONB;
  v_fb     JSONB;
  v_d_a    NUMERIC;
  v_d_b    NUMERIC;
  v_ra     NUMERIC;
  v_rb     NUMERIC;
  v_radius JSONB;
BEGIN
  IF a_formulas IS NULL OR b_formulas IS NULL THEN
    RETURN FALSE;
  END IF;
  FOR v_fa IN SELECT * FROM jsonb_array_elements(a_formulas) LOOP
    v_radius := v_fa->'radius';
    IF v_radius IS NOT NULL THEN
      v_ra := LEAST(
        COALESCE((v_radius->>'baseRadius')::NUMERIC, 0)
          + GREATEST(a_wait_sec, 0)
            * COALESCE((v_radius->>'radiusGrowthPerSecond')::NUMERIC, 0),
        COALESCE((v_radius->>'maxRadius')::NUMERIC,
                 (v_radius->>'baseRadius')::NUMERIC)
      );
    ELSE
      v_ra := a_radius;
    END IF;
    FOR v_fb IN SELECT * FROM jsonb_array_elements(b_formulas) LOOP
      v_radius := v_fb->'radius';
      IF v_radius IS NOT NULL THEN
        v_rb := LEAST(
          COALESCE((v_radius->>'baseRadius')::NUMERIC, 0)
            + GREATEST(b_wait_sec, 0)
              * COALESCE((v_radius->>'radiusGrowthPerSecond')::NUMERIC, 0),
          COALESCE((v_radius->>'maxRadius')::NUMERIC,
                   (v_radius->>'baseRadius')::NUMERIC)
        );
      ELSE
        v_rb := b_radius;
      END IF;
      IF NOT matchmaking_pair_compatible(a_data, b_data, v_fa->'partition') THEN
        CONTINUE;
      END IF;
      IF NOT matchmaking_pair_compatible(a_data, b_data, v_fb->'partition') THEN
        CONTINUE;
      END IF;
      v_d_a := matchmaking_pair_distance(
        a_data, b_data, v_fa->'numeric', v_fa->'categorical'
      );
      v_d_b := matchmaking_pair_distance(
        a_data, b_data, v_fb->'numeric', v_fb->'categorical'
      );
      IF v_d_a <= v_ra AND v_d_b <= v_rb THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  END LOOP;
  RETURN FALSE;
END;
$matchmaking_pair_match$;
`.trim();

/**
 * One full match pass for one (partition, group_size) pair. v5
 * semantics:
 *
 *   - Snapshot CTE: lock up to `p_max_pairs * p_group_size * 4`
 *     waiting rows for THIS (signature, group_size) in
 *     `(priority DESC, joined_at ASC)` order so high-priority joiners
 *     seed first. `FOR UPDATE SKIP LOCKED` lets the function safely
 *     run in parallel with itself.
 *   - Per-row wait_sec is computed once at snapshot time and threaded
 *     into `matchmaking_pair_match` so per-formula radii can compute
 *     their own elapsed-radius without re-reading the clock.
 *   - Greedy seeding: highest-priority-FIFO unmatched waiter is the
 *     seed `i`. Walk later candidates `j`; admit `j` only when it
 *     pair_matches EVERY current group member (the "pairwise"
 *     requirement).
 *   - When `|group| == p_group_size`, atomic DELETE all N rows from
 *     `matchmaking_waiting` then bulk INSERT into
 *     `matchmaking_matched` sharing one fresh `match_id`, preserving
 *     each row's `metadata` payload across the pairing boundary.
 */
export const CREATE_RUN_MATCH_PASS_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_run_match_pass(
  p_partition_signature  TEXT,
  p_base_radius          NUMERIC,
  p_growth_per_sec       NUMERIC,
  p_max_radius           NUMERIC,
  p_max_pairs            INT,
  p_bucket_width         NUMERIC,
  p_group_size           INT,
  p_now                  TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  match_id       UUID,
  participant_id UUID,
  joined_at      TIMESTAMPTZ,
  data           JSONB
)
LANGUAGE plpgsql AS $matchmaking_run_match_pass$
DECLARE
  v_now         TIMESTAMPTZ := COALESCE(p_now, now());
  v_ids         UUID[];
  v_joined_ats  TIMESTAMPTZ[];
  v_waits       NUMERIC[];
  v_radii       NUMERIC[];
  v_datas       JSONB[];
  v_formulas    JSONB[];
  v_metadatas   JSONB[];
  v_buckets     INT[];
  v_taken       BOOLEAN[];
  v_n           INT;
  v_i           INT;
  v_j           INT;
  v_k           INT;
  v_ring        INT;
  v_match_id    UUID;
  v_claimed     INT;
  v_deleted     INT;
  v_group_idxs  INT[];
  v_group_ids   UUID[];
  v_compatible  BOOLEAN;
BEGIN
  IF p_max_pairs <= 0 THEN RETURN; END IF;
  IF p_group_size < 2 THEN RETURN; END IF;

  WITH locked AS (
    SELECT q.id, q.joined_at, q.priority, q.data, q.formulas, q.metadata,
           q.primary_bucket,
           GREATEST(EXTRACT(EPOCH FROM (v_now - q.joined_at)), 0)::NUMERIC
             AS wait_sec,
           LEAST(
             p_base_radius +
               GREATEST(EXTRACT(EPOCH FROM (v_now - q.joined_at)), 0)
                 * p_growth_per_sec,
             p_max_radius
           )::NUMERIC AS radius
    FROM matchmaking_waiting q
    WHERE q.partition_signature = p_partition_signature
      AND q.group_size = p_group_size
    ORDER BY q.priority DESC, q.joined_at ASC
    LIMIT p_max_pairs * p_group_size * 4
    FOR UPDATE SKIP LOCKED
  )
  SELECT
    array_agg(locked.id              ORDER BY locked.priority DESC, locked.joined_at ASC),
    array_agg(locked.joined_at       ORDER BY locked.priority DESC, locked.joined_at ASC),
    array_agg(locked.wait_sec        ORDER BY locked.priority DESC, locked.joined_at ASC),
    array_agg(locked.radius          ORDER BY locked.priority DESC, locked.joined_at ASC),
    array_agg(locked.data            ORDER BY locked.priority DESC, locked.joined_at ASC),
    array_agg(locked.formulas        ORDER BY locked.priority DESC, locked.joined_at ASC),
    array_agg(locked.metadata        ORDER BY locked.priority DESC, locked.joined_at ASC),
    array_agg(locked.primary_bucket  ORDER BY locked.priority DESC, locked.joined_at ASC)
  INTO v_ids, v_joined_ats, v_waits, v_radii, v_datas, v_formulas,
       v_metadatas, v_buckets
  FROM locked;

  IF v_ids IS NULL THEN RETURN; END IF;
  v_n := array_length(v_ids, 1);
  IF v_n < p_group_size THEN RETURN; END IF;
  v_taken := array_fill(FALSE, ARRAY[v_n]);
  v_claimed := 0;

  FOR v_i IN 1..v_n - (p_group_size - 1) LOOP
    IF v_taken[v_i] THEN CONTINUE; END IF;
    IF v_claimed >= p_max_pairs THEN EXIT; END IF;

    v_ring := CEIL(v_radii[v_i] / GREATEST(p_bucket_width, 1));
    v_group_idxs := ARRAY[v_i];

    FOR v_j IN v_i + 1..v_n LOOP
      IF v_taken[v_j] THEN CONTINUE; END IF;
      IF v_buckets[v_i] IS NOT NULL AND v_buckets[v_j] IS NOT NULL
         AND ABS(v_buckets[v_i] - v_buckets[v_j]) > v_ring THEN
        CONTINUE;
      END IF;
      v_compatible := TRUE;
      FOR v_k IN 1..array_length(v_group_idxs, 1) LOOP
        IF NOT matchmaking_pair_match(
          v_datas[v_group_idxs[v_k]],
          v_formulas[v_group_idxs[v_k]],
          v_radii[v_group_idxs[v_k]],
          v_waits[v_group_idxs[v_k]],
          v_datas[v_j], v_formulas[v_j], v_radii[v_j], v_waits[v_j]
        ) THEN
          v_compatible := FALSE;
          EXIT;
        END IF;
      END LOOP;
      IF NOT v_compatible THEN CONTINUE; END IF;
      v_group_idxs := array_append(v_group_idxs, v_j);
      IF array_length(v_group_idxs, 1) = p_group_size THEN
        EXIT;
      END IF;
    END LOOP;

    IF array_length(v_group_idxs, 1) < p_group_size THEN
      CONTINUE;
    END IF;

    v_group_ids := ARRAY[]::UUID[];
    FOR v_k IN 1..p_group_size LOOP
      v_group_ids := array_append(v_group_ids, v_ids[v_group_idxs[v_k]]);
    END LOOP;

    v_match_id := gen_random_uuid();

    WITH del AS (
      DELETE FROM matchmaking_waiting w
      WHERE w.id = ANY(v_group_ids)
        AND w.partition_signature = p_partition_signature
        AND w.group_size = p_group_size
      RETURNING w.id
    )
    SELECT COUNT(*) INTO v_deleted FROM del;

    IF v_deleted < p_group_size THEN
      -- Lost the race for at least one row between snapshot and
      -- delete; skip and try the next seeker.
      CONTINUE;
    END IF;

    FOR v_k IN 1..p_group_size LOOP
      INSERT INTO matchmaking_matched
        (id, match_id, joined_at, matched_at, data, metadata)
      VALUES (
        v_ids[v_group_idxs[v_k]],
        v_match_id,
        v_joined_ats[v_group_idxs[v_k]],
        v_now,
        v_datas[v_group_idxs[v_k]],
        v_metadatas[v_group_idxs[v_k]]
      );
      v_taken[v_group_idxs[v_k]] := TRUE;
    END LOOP;
    v_claimed := v_claimed + 1;

    RETURN QUERY
    SELECT v_match_id, m.id, m.joined_at, m.data
    FROM matchmaking_matched m
    WHERE m.match_id = v_match_id
    ORDER BY m.joined_at;
  END LOOP;
END;
$matchmaking_run_match_pass$;
`.trim();

/**
 * Per-partition abandonment sweep — drops waiting rows older than
 * `p_max_age_seconds`. No throttle (see file-level doc).
 */
export const CREATE_SWEEP_EXPIRED_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_sweep_expired(
  p_partition_signature TEXT,
  p_max_age_seconds     INT,
  p_now                 TIMESTAMPTZ DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql AS $matchmaking_sweep_expired$
DECLARE
  v_now      TIMESTAMPTZ := COALESCE(p_now, now());
  v_max_age  INTERVAL;
  v_deleted  BIGINT := 0;
BEGIN
  IF p_max_age_seconds <= 0 THEN RETURN 0; END IF;
  v_max_age := make_interval(secs => p_max_age_seconds);
  WITH del AS (
    DELETE FROM matchmaking_waiting
    WHERE partition_signature = p_partition_signature
      AND joined_at < v_now - v_max_age
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM del;
  RETURN v_deleted;
END;
$matchmaking_sweep_expired$;
`.trim();

/**
 * The unconditional drop for any prior `matchmaking_tick()` body. Run
 * before re-creating so a signature change (new tunings baked in) doesn't
 * collide with an installed older version. `CREATE OR REPLACE` would
 * handle most cases, but a strict DROP keeps the install path identical
 * regardless of pg_cron version or what was there before.
 */
export const DROP_TICK_FUNCTION_SQL = `
DROP FUNCTION IF EXISTS matchmaking_tick()
`.trim();

/**
 * Stable advisory lock id used by `matchmaking_tick()` (the cron-
 * driven SQL function) AND by `Matchmaking.tick()` (the JS driver)
 * for their shared single-flight guard. Arbitrary 64-bit constant;
 * just needs to be unique within this database so no unrelated
 * caller collides. Changing this is a deployment decision.
 */
// Tick-function builder + the advisory lock id live in `tick-sql.ts`
// to keep this file under the per-file line cap. Re-exported here as
// the canonical migrate.ts surface so nothing else has to know there
// are two files.
export {
  buildCreateTickFunctionSql,
  MATCHMAKING_TICK_ADVISORY_LOCK_ID,
  type TickFunctionTunings,
} from './tick-sql';

/**
 * Global cleanup of matched rows older than `p_max_age_seconds`. Hits a
 * single index range scan on `matchmaking_matched_matched_at_idx`. No
 * throttle.
 */
export const CREATE_SWEEP_MATCHED_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_sweep_matched(
  p_max_age_seconds INT,
  p_now             TIMESTAMPTZ DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql AS $matchmaking_sweep_matched$
DECLARE
  v_now      TIMESTAMPTZ := COALESCE(p_now, now());
  v_max_age  INTERVAL;
  v_deleted  BIGINT := 0;
BEGIN
  IF p_max_age_seconds <= 0 THEN RETURN 0; END IF;
  v_max_age := make_interval(secs => p_max_age_seconds);
  WITH del AS (
    DELETE FROM matchmaking_matched
    WHERE matched_at < v_now - v_max_age
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM del;
  RETURN v_deleted;
END;
$matchmaking_sweep_matched$;
`.trim();
