/**
 * Pure SQL strings for {@link migrate}. Split out so `migrate.ts` stays
 * focused on orchestration (idempotency checks, fingerprint compare,
 * sequencing) and the file-size cap stays comfortable.
 *
 * Nothing here knows about the caller-declared `MatchmakingSchema` —
 * schema-dependent DDL (generated column expressions, partition shape) is
 * built in `migrate.ts` from helper functions there.
 */

export const DROP_LEGACY_COLUMN_SQL = `
ALTER TABLE IF EXISTS matchmaking_queue DROP COLUMN IF EXISTS rating
`.trim();

export const DROP_LEGACY_INDEX_SQL = `
DROP INDEX IF EXISTS matchmaking_queue_status_rating_idx
`.trim();

export const DROP_OLD_JOINED_AT_INDEX_SQL = `
DROP INDEX IF EXISTS matchmaking_queue_status_joined_at_idx
`.trim();

// Replaced by the partial waiting index — drop unconditionally on every
// migrate so old installs get the partial index instead.
export const DROP_OLD_BUCKET_INDEX_SQL = `
DROP INDEX IF EXISTS matchmaking_queue_status_bucket_idx
`.trim();

export const DROP_WAITING_INDEX_SQL = `
DROP INDEX IF EXISTS matchmaking_queue_waiting_partition_bucket_idx
`.trim();

export const DROP_MATCHED_INDEX_SQL = `
DROP INDEX IF EXISTS matchmaking_queue_matched_joined_at_idx
`.trim();

// `gen_random_uuid()` is built into Postgres 13+ (no `pgcrypto` extension
// required) and is also available in PGlite. `fillfactor=80` leaves slack
// for HOT updates: with both hot indexes being partial (waiting vs
// matched), the status='waiting'→'matched' flip touches neither index.
export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status    TEXT NOT NULL DEFAULT 'waiting',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data      JSONB NOT NULL DEFAULT '{}',
  formulas  JSONB NOT NULL DEFAULT '[]',
  match_id  UUID NULL
) WITH (fillfactor = 80)
`.trim();

export const SET_FILLFACTOR_SQL = `
ALTER TABLE matchmaking_queue SET (fillfactor = 80)
`.trim();

export const ALTER_ADD_LEGACY_COLUMNS_SQL = `
ALTER TABLE matchmaking_queue
  ADD COLUMN IF NOT EXISTS formulas JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS match_id UUID NULL
`.trim();

// Lets `status(participantId)` quickly find peer rows by match_id.
export const CREATE_MATCH_ID_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_queue_match_id_idx
  ON matchmaking_queue (match_id)
`.trim();

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

// Per-(partition_signature, kind) throttle table. `kind` codes:
//   1 = pass throttle
//   2 = sweep-waiting throttle
//   3 = sweep-matched throttle (sentinel: partition_signature='')
// Rows are auto-created on first reference per partition via
// `INSERT ... ON CONFLICT DO NOTHING` inside the SQL functions, so the
// caller never has to seed anything.
export const CREATE_PASS_RUNS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_pass_runs (
  partition_signature TEXT NOT NULL,
  kind                SMALLINT NOT NULL,
  last_at             TIMESTAMPTZ NOT NULL DEFAULT 'epoch',
  PRIMARY KEY (partition_signature, kind)
)
`.trim();

export const DROP_GENERATED_COLUMNS_SQL = `
ALTER TABLE matchmaking_queue
  DROP COLUMN IF EXISTS primary_bucket,
  DROP COLUMN IF EXISTS primary_rating,
  DROP COLUMN IF EXISTS partition_signature
`.trim();

// Hot path index. Partial on status='waiting' so matched rows don't
// bloat the snapshot scan. Order: (partition_signature, primary_bucket,
// joined_at) — partition-scoped snapshot CTE walks the index in
// `joined_at` order within the right bucket range without any sort step.
export const CREATE_WAITING_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_queue_waiting_partition_bucket_idx
  ON matchmaking_queue (partition_signature, primary_bucket, joined_at)
  WHERE status = 'waiting'
`.trim();

// Drives `matchmaking_sweep_matched` — keeps matched-row deletion
// O(rows_to_delete) instead of O(table_size).
export const CREATE_MATCHED_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_queue_matched_joined_at_idx
  ON matchmaking_queue (joined_at)
  WHERE status = 'matched'
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

export const CREATE_PAIR_MATCH_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_pair_match(
  a_data     JSONB,
  a_formulas JSONB,
  a_radius   NUMERIC,
  b_data     JSONB,
  b_formulas JSONB,
  b_radius   NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $matchmaking_pair_match$
DECLARE
  v_fa  JSONB;
  v_fb  JSONB;
  v_d_a NUMERIC;
  v_d_b NUMERIC;
BEGIN
  IF a_formulas IS NULL OR b_formulas IS NULL THEN
    RETURN FALSE;
  END IF;
  FOR v_fa IN SELECT * FROM jsonb_array_elements(a_formulas) LOOP
    FOR v_fb IN SELECT * FROM jsonb_array_elements(b_formulas) LOOP
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
      IF v_d_a <= a_radius AND v_d_b <= b_radius THEN
        RETURN TRUE;
      END IF;
    END LOOP;
  END LOOP;
  RETURN FALSE;
END;
$matchmaking_pair_match$;
`.trim();

// Drop every prior signature so a fresh CREATE leaves exactly one version
// installed regardless of which schema generation last ran. Includes the
// pre-partition signatures since this rev is breaking.
export const DROP_RUN_MATCH_PASS_LEGACY_SIGNATURES = [
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(INT, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(INT, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB, JSONB, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(NUMERIC, NUMERIC, NUMERIC, INT, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(NUMERIC, NUMERIC, NUMERIC, INT, INT, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(NUMERIC, NUMERIC, NUMERIC, INT, INT, NUMERIC, TIMESTAMPTZ)`,
];

export const DROP_SWEEP_EXPIRED_LEGACY_SIGNATURES = [
  `DROP FUNCTION IF EXISTS matchmaking_sweep_expired(INT)`,
  `DROP FUNCTION IF EXISTS matchmaking_sweep_expired(INT, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_sweep_expired(INT, INT, TIMESTAMPTZ)`,
];

export const DROP_SWEEP_MATCHED_LEGACY_SIGNATURES = [
  `DROP FUNCTION IF EXISTS matchmaking_sweep_matched(INT)`,
  `DROP FUNCTION IF EXISTS matchmaking_sweep_matched(INT, INT)`,
];

/**
 * One full match pass for one partition.
 *
 * Per-partition concurrency / cost control:
 *   - Lazy-creates `matchmaking_pass_runs(p_partition_signature, 1)` then
 *     locks it `FOR UPDATE SKIP LOCKED`. Concurrent calls for the SAME
 *     partition return 0 rows immediately; calls for DIFFERENT partitions
 *     never see each other.
 *   - When `now() - last_at < p_min_pass_interval_ms`, returns 0 rows
 *     immediately. Per-partition throttle: a hot partition's throttle
 *     doesn't slow cold partitions.
 *
 * Algorithm:
 *   1. Snapshot up to `p_max_pairs * 4` `status='waiting'` rows for THIS
 *      partition in FIFO order, served by the partial waiting index.
 *      Locked with `FOR UPDATE SKIP LOCKED`.
 *   2. Each participant gets an expanding radius
 *      `r = LEAST(base + max(0, wait_seconds) * growth, max)`.
 *   3. Greedy FIFO seeding: for the oldest unmatched waiter, scan
 *      remaining unmatched candidates in `joined_at` order. Pre-filter on
 *      bucket distance `ceil(radius / bucket_width)` (the partition is
 *      uniform inside the snapshot — no per-pair partition check needed).
 *      The first candidate that survives `matchmaking_pair_match` is
 *      paired.
 *   4. Claim each pair atomically with a CAS-style UPDATE; if the claim
 *      returns 0 rows (lost the race), skip and continue.
 *   5. Cap iterations at `p_max_pairs` pairs per call.
 */
export const CREATE_RUN_MATCH_PASS_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_run_match_pass(
  p_partition_signature  TEXT,
  p_base_radius          NUMERIC,
  p_growth_per_sec       NUMERIC,
  p_max_radius           NUMERIC,
  p_max_pairs            INT,
  p_min_pass_interval_ms INT,
  p_bucket_width         NUMERIC,
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
  v_last        TIMESTAMPTZ;
  v_min_int     INTERVAL;
  v_ids         UUID[];
  v_joined_ats  TIMESTAMPTZ[];
  v_radii       NUMERIC[];
  v_datas       JSONB[];
  v_formulas    JSONB[];
  v_buckets     INT[];
  v_taken       BOOLEAN[];
  v_n           INT;
  v_i           INT;
  v_j           INT;
  v_ring        INT;
  v_match_id    UUID;
  v_claimed     INT;
BEGIN
  IF p_max_pairs <= 0 THEN RETURN; END IF;

  INSERT INTO matchmaking_pass_runs (partition_signature, kind)
  VALUES (p_partition_signature, 1)
  ON CONFLICT DO NOTHING;

  SELECT last_at INTO v_last
  FROM matchmaking_pass_runs
  WHERE partition_signature = p_partition_signature AND kind = 1
  FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN; END IF;

  v_min_int := make_interval(secs => GREATEST(p_min_pass_interval_ms, 0) / 1000.0);
  IF v_now - v_last < v_min_int THEN
    RETURN;
  END IF;
  UPDATE matchmaking_pass_runs
  SET last_at = v_now
  WHERE partition_signature = p_partition_signature AND kind = 1;

  WITH locked AS (
    SELECT q.id, q.joined_at, q.data, q.formulas, q.primary_bucket,
           LEAST(
             p_base_radius +
               GREATEST(EXTRACT(EPOCH FROM (v_now - q.joined_at)), 0)
                 * p_growth_per_sec,
             p_max_radius
           )::NUMERIC AS radius
    FROM matchmaking_queue q
    WHERE q.status = 'waiting'
      AND q.partition_signature = p_partition_signature
    ORDER BY q.joined_at ASC
    LIMIT p_max_pairs * 4
    FOR UPDATE SKIP LOCKED
  )
  SELECT
    array_agg(locked.id              ORDER BY locked.joined_at ASC),
    array_agg(locked.joined_at       ORDER BY locked.joined_at ASC),
    array_agg(locked.radius          ORDER BY locked.joined_at ASC),
    array_agg(locked.data            ORDER BY locked.joined_at ASC),
    array_agg(locked.formulas        ORDER BY locked.joined_at ASC),
    array_agg(locked.primary_bucket  ORDER BY locked.joined_at ASC)
  INTO v_ids, v_joined_ats, v_radii, v_datas, v_formulas, v_buckets
  FROM locked;

  IF v_ids IS NULL THEN RETURN; END IF;
  v_n := array_length(v_ids, 1);
  IF v_n < 2 THEN RETURN; END IF;
  v_taken := array_fill(FALSE, ARRAY[v_n]);
  v_claimed := 0;

  FOR v_i IN 1..v_n - 1 LOOP
    IF v_taken[v_i] THEN CONTINUE; END IF;
    IF v_claimed >= p_max_pairs THEN EXIT; END IF;

    v_ring := CEIL(v_radii[v_i] / GREATEST(p_bucket_width, 1));

    FOR v_j IN v_i + 1..v_n LOOP
      IF v_taken[v_j] THEN CONTINUE; END IF;
      IF v_buckets[v_i] IS NOT NULL AND v_buckets[v_j] IS NOT NULL
         AND ABS(v_buckets[v_i] - v_buckets[v_j]) > v_ring THEN
        CONTINUE;
      END IF;
      IF NOT matchmaking_pair_match(
        v_datas[v_i], v_formulas[v_i], v_radii[v_i],
        v_datas[v_j], v_formulas[v_j], v_radii[v_j]
      ) THEN CONTINUE; END IF;

      v_match_id := gen_random_uuid();
      v_taken[v_i] := TRUE;
      v_taken[v_j] := TRUE;

      UPDATE matchmaking_queue
      SET status   = 'matched',
          match_id = v_match_id
      WHERE id = ANY(ARRAY[v_ids[v_i], v_ids[v_j]])
        AND status = 'waiting';

      IF NOT FOUND THEN
        v_taken[v_i] := FALSE;
        v_taken[v_j] := FALSE;
        CONTINUE;
      END IF;

      RETURN QUERY
      SELECT v_match_id, q.id, q.joined_at, q.data
      FROM matchmaking_queue q
      WHERE q.id = ANY(ARRAY[v_ids[v_i], v_ids[v_j]])
      ORDER BY q.joined_at;

      v_claimed := v_claimed + 1;
      EXIT;
    END LOOP;
  END LOOP;
END;
$matchmaking_run_match_pass$;
`.trim();

/**
 * Per-partition abandonment sweep. Same throttle pattern as
 * `matchmaking_run_match_pass` but against `(p_partition_signature, 2)`.
 */
export const CREATE_SWEEP_EXPIRED_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_sweep_expired(
  p_partition_signature   TEXT,
  p_max_age_seconds       INT,
  p_min_sweep_interval_ms INT,
  p_now                   TIMESTAMPTZ DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql AS $matchmaking_sweep_expired$
DECLARE
  v_now      TIMESTAMPTZ := COALESCE(p_now, now());
  v_last     TIMESTAMPTZ;
  v_min_int  INTERVAL;
  v_max_age  INTERVAL;
  v_deleted  BIGINT := 0;
BEGIN
  IF p_max_age_seconds <= 0 THEN RETURN 0; END IF;

  INSERT INTO matchmaking_pass_runs (partition_signature, kind)
  VALUES (p_partition_signature, 2)
  ON CONFLICT DO NOTHING;

  SELECT last_at INTO v_last
  FROM matchmaking_pass_runs
  WHERE partition_signature = p_partition_signature AND kind = 2
  FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_min_int := make_interval(secs => GREATEST(p_min_sweep_interval_ms, 0) / 1000.0);
  IF v_now - v_last < v_min_int THEN
    RETURN 0;
  END IF;
  UPDATE matchmaking_pass_runs
  SET last_at = v_now
  WHERE partition_signature = p_partition_signature AND kind = 2;

  v_max_age := make_interval(secs => p_max_age_seconds);
  WITH del AS (
    DELETE FROM matchmaking_queue
    WHERE status = 'waiting'
      AND partition_signature = p_partition_signature
      AND joined_at < v_now - v_max_age
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM del;

  RETURN v_deleted;
END;
$matchmaking_sweep_expired$;
`.trim();

/**
 * Global cleanup of matched rows older than `p_max_age_seconds`. Matched
 * rows stay queryable by `status(participantId)` until this sweep removes
 * them — set retention to comfortably exceed the longest plausible
 * `/status` poll loop after a pair is made. Throttled against the
 * `('', 3)` sentinel row in `matchmaking_pass_runs`. The age comparison
 * uses `joined_at` (matchmaking horizons are seconds-to-minutes, so
 * `joined_at` is a tight upper bound for `matched_at`).
 */
export const CREATE_SWEEP_MATCHED_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_sweep_matched(
  p_max_age_seconds       INT,
  p_min_sweep_interval_ms INT,
  p_now                   TIMESTAMPTZ DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql AS $matchmaking_sweep_matched$
DECLARE
  v_now      TIMESTAMPTZ := COALESCE(p_now, now());
  v_last     TIMESTAMPTZ;
  v_min_int  INTERVAL;
  v_max_age  INTERVAL;
  v_deleted  BIGINT := 0;
BEGIN
  IF p_max_age_seconds <= 0 THEN RETURN 0; END IF;

  INSERT INTO matchmaking_pass_runs (partition_signature, kind)
  VALUES ('', 3)
  ON CONFLICT DO NOTHING;

  SELECT last_at INTO v_last
  FROM matchmaking_pass_runs
  WHERE partition_signature = '' AND kind = 3
  FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_min_int := make_interval(secs => GREATEST(p_min_sweep_interval_ms, 0) / 1000.0);
  IF v_now - v_last < v_min_int THEN
    RETURN 0;
  END IF;
  UPDATE matchmaking_pass_runs
  SET last_at = v_now
  WHERE partition_signature = '' AND kind = 3;

  v_max_age := make_interval(secs => p_max_age_seconds);
  WITH del AS (
    DELETE FROM matchmaking_queue
    WHERE status = 'matched'
      AND joined_at < v_now - v_max_age
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM del;

  RETURN v_deleted;
END;
$matchmaking_sweep_matched$;
`.trim();
