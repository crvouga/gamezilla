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
 * Throttle plumbing (`matchmaking_pass_runs`, `FOR UPDATE SKIP LOCKED`
 * dance, `minPassIntervalMs` / `sweepIntervalMs` parameters) is GONE.
 * The host-owned scheduler (Durable Object alarm) is the sole caller of
 * `runMatchPass` / `sweep_*`, and is self-throttled by its alarm
 * cadence. Removing the throttle row removes a hot single-row write
 * contention point and several index-only writes per pass kick.
 *
 * Nothing here knows about the caller-declared `MatchmakingSchema` —
 * schema-dependent DDL (generated column expressions) is built in
 * `migrate.ts` from helper functions there.
 */

export const NUM_WAITING_PARTITIONS = 16;

// Schema v3 drops the legacy `matchmaking_queue` table and the
// `matchmaking_pass_runs` throttle table. We unconditionally drop both
// in the upfront DDL so v2-or-earlier installs migrate cleanly.
export const DROP_LEGACY_QUEUE_SQL = `
DROP TABLE IF EXISTS matchmaking_queue CASCADE
`.trim();

export const DROP_LEGACY_PASS_RUNS_SQL = `
DROP TABLE IF EXISTS matchmaking_pass_runs CASCADE
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

// Helper table — see file-level doc. UNLOGGED because the side table is
// regenerated on every join; if it goes missing on crash, the next
// `/join` re-creates the entry. Per-partition writes are O(1).
export const CREATE_ACTIVE_PARTITIONS_TABLE_SQL = `
CREATE UNLOGGED TABLE IF NOT EXISTS matchmaking_active_partitions (
  partition_signature TEXT PRIMARY KEY,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now()
)
`.trim();

// Matched-rows table. LOGGED (these are the only durable matchmaking
// rows — a server crash must not lose paired-but-not-yet-polled match
// state). PRIMARY KEY (id) for status() lookups; index on match_id for
// peer fetch; index on matched_at for sweep.
export const CREATE_MATCHED_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_matched (
  id          UUID    PRIMARY KEY,
  match_id    UUID    NOT NULL,
  joined_at   TIMESTAMPTZ NOT NULL,
  matched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  data        JSONB   NOT NULL
)
`.trim();

export const CREATE_MATCHED_MATCH_ID_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_matched_match_id_idx
  ON matchmaking_matched (match_id)
`.trim();

export const CREATE_MATCHED_MATCHED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_matched_matched_at_idx
  ON matchmaking_matched (matched_at)
`.trim();

// Cleanup of any v2 generated columns / indexes that linger after the
// `matchmaking_queue` DROP above. `matchmaking_queue` is gone by the
// time we reach here; these DROPs are belt-and-braces for partial-
// migration scenarios. Split into individual statements because PGlite
// and the standard PG protocol both reject multi-statement prepared
// queries; `migrate.ts` iterates over the array.
export const DROP_LEGACY_INDEXES = [
  `DROP INDEX IF EXISTS matchmaking_queue_waiting_partition_bucket_idx`,
  `DROP INDEX IF EXISTS matchmaking_queue_matched_joined_at_idx`,
  `DROP INDEX IF EXISTS matchmaking_queue_match_id_idx`,
  `DROP INDEX IF EXISTS matchmaking_queue_status_joined_at_idx`,
  `DROP INDEX IF EXISTS matchmaking_queue_status_rating_idx`,
  `DROP INDEX IF EXISTS matchmaking_queue_status_bucket_idx`,
];

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

// Hot path index. Order: (partition_signature, primary_bucket,
// joined_at) — the per-partition snapshot CTE walks the index in
// joined_at order within the right bucket range without any sort step.
// Index lives on the parent and propagates to all 16 child partitions.
export const CREATE_WAITING_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_waiting_partition_bucket_idx
  ON matchmaking_waiting (partition_signature, primary_bucket, joined_at)
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
// installed regardless of which schema generation last ran.
export const DROP_RUN_MATCH_PASS_LEGACY_SIGNATURES = [
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(INT, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(INT, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB, JSONB, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(NUMERIC, NUMERIC, NUMERIC, INT, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(NUMERIC, NUMERIC, NUMERIC, INT, INT, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(NUMERIC, NUMERIC, NUMERIC, INT, INT, NUMERIC, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_run_match_pass(TEXT, NUMERIC, NUMERIC, NUMERIC, INT, INT, NUMERIC, TIMESTAMPTZ)`,
];

export const DROP_SWEEP_EXPIRED_LEGACY_SIGNATURES = [
  `DROP FUNCTION IF EXISTS matchmaking_sweep_expired(INT)`,
  `DROP FUNCTION IF EXISTS matchmaking_sweep_expired(INT, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_sweep_expired(INT, INT, TIMESTAMPTZ)`,
  `DROP FUNCTION IF EXISTS matchmaking_sweep_expired(TEXT, INT, INT, TIMESTAMPTZ)`,
];

export const DROP_SWEEP_MATCHED_LEGACY_SIGNATURES = [
  `DROP FUNCTION IF EXISTS matchmaking_sweep_matched(INT)`,
  `DROP FUNCTION IF EXISTS matchmaking_sweep_matched(INT, INT)`,
  `DROP FUNCTION IF EXISTS matchmaking_sweep_matched(INT, INT, TIMESTAMPTZ)`,
];

/**
 * One full match pass for one partition. v3 semantics:
 *
 *   - NO throttle row, NO FOR UPDATE SKIP LOCKED dance — the host-owned
 *     ticker is the sole caller and is self-throttled by its alarm
 *     cadence. Removing the throttle removes a hot single-row write
 *     contention point.
 *   - Snapshot CTE: lock up to `p_max_pairs * 4` waiting rows for THIS
 *     partition in FIFO order. `FOR UPDATE SKIP LOCKED` on the rows
 *     themselves keeps parallel ticker invocations from clobbering each
 *     other (defence in depth — the ticker DO already serialises
 *     itself).
 *   - Per pair: DELETE both rows from `matchmaking_waiting` and INSERT
 *     into `matchmaking_matched` in a single CTE statement (atomic; if
 *     either DELETE returns 0 rows, the INSERT is skipped naturally).
 *     This replaces the v2 CAS-via-UPDATE pattern and eliminates the
 *     `status` column entirely (a row's table IS its status).
 *   - Greedy FIFO seeding: oldest unmatched waiter scans remaining
 *     candidates in joined_at order; bucket pre-filter then
 *     `matchmaking_pair_match`; cap iterations at `p_max_pairs`.
 */
export const CREATE_RUN_MATCH_PASS_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_run_match_pass(
  p_partition_signature  TEXT,
  p_base_radius          NUMERIC,
  p_growth_per_sec       NUMERIC,
  p_max_radius           NUMERIC,
  p_max_pairs            INT,
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
  v_a_id        UUID;
  v_b_id        UUID;
  v_a_data      JSONB;
  v_b_data      JSONB;
  v_a_joined    TIMESTAMPTZ;
  v_b_joined    TIMESTAMPTZ;
  v_deleted     INT;
BEGIN
  IF p_max_pairs <= 0 THEN RETURN; END IF;

  WITH locked AS (
    SELECT q.id, q.joined_at, q.data, q.formulas, q.primary_bucket,
           LEAST(
             p_base_radius +
               GREATEST(EXTRACT(EPOCH FROM (v_now - q.joined_at)), 0)
                 * p_growth_per_sec,
             p_max_radius
           )::NUMERIC AS radius
    FROM matchmaking_waiting q
    WHERE q.partition_signature = p_partition_signature
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
      v_a_id := v_ids[v_i];
      v_b_id := v_ids[v_j];
      v_a_data := v_datas[v_i];
      v_b_data := v_datas[v_j];
      v_a_joined := v_joined_ats[v_i];
      v_b_joined := v_joined_ats[v_j];

      WITH del AS (
        DELETE FROM matchmaking_waiting w
        WHERE w.id IN (v_a_id, v_b_id)
          AND w.partition_signature = p_partition_signature
        RETURNING w.id
      )
      SELECT COUNT(*) INTO v_deleted FROM del;

      IF v_deleted < 2 THEN
        -- Lost the race for at least one row (another concurrent caller
        -- claimed it between our snapshot and our DELETE). Roll back
        -- our local "taken" bookkeeping and try the next candidate.
        CONTINUE;
      END IF;

      INSERT INTO matchmaking_matched
        (id, match_id, joined_at, matched_at, data)
      VALUES
        (v_a_id, v_match_id, v_a_joined, v_now, v_a_data),
        (v_b_id, v_match_id, v_b_joined, v_now, v_b_data);

      v_taken[v_i] := TRUE;
      v_taken[v_j] := TRUE;
      v_claimed := v_claimed + 1;

      RETURN QUERY
      SELECT v_match_id, m.id, m.joined_at, m.data
      FROM matchmaking_matched m
      WHERE m.match_id = v_match_id
      ORDER BY m.joined_at;

      EXIT;
    END LOOP;
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
 * Builds the PL/pgSQL `matchmaking_tick()` function. Tunings (radius,
 * sweep windows, per-pass cap, bucket width, fan-out cap) are baked
 * directly into the function body at migrate time — no parameters, no
 * runtime overhead for tuning lookups, and the function signature stays
 * `() RETURNS VOID` so pg_cron just calls `SELECT matchmaking_tick()`.
 *
 * Single-flight guard: `pg_try_advisory_lock(bigint)` on a stable lock
 * id. Concurrent invocations (overlapping cron ticks under sustained
 * load, or a manual `mm.tick()` racing the cron) return immediately
 * when the lock is held. This is defence in depth — pg_cron does not
 * skip overlapping invocations on its own.
 *
 * Failure handling: every Postgres error inside the BEGIN..EXCEPTION
 * block unlocks the advisory lock and re-raises. pg_cron captures the
 * error in `cron.job_run_details`; the next interval retries.
 *
 * The drain loop per partition mirrors `Matchmaker.runMatchPasses`:
 * call `matchmaking_run_match_pass` until it returns 0 matches OR we
 * hit {@link DRAIN_MAX_PASSES_PER_PARTITION}. After all partitions,
 * prune `matchmaking_active_partitions` of any signatures that drained
 * to zero waiters (mirrors the JS `runMatchPassesAcrossPartitions`
 * tail).
 */
/**
 * Stable advisory lock id used by `matchmaking_tick()` for its
 * single-flight guard. Arbitrary 64-bit constant; just needs to be
 * unique within this database so no unrelated caller collides.
 */
const TICK_ADVISORY_LOCK_ID = '7723344891234567000';

function numericLit(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error(
      `matchmaking tick: non-finite numeric tunable: ${String(n)}`
    );
  }
  return n.toString();
}

function intLit(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `matchmaking tick: non-integer or negative tunable: ${String(n)}`
    );
  }
  return n.toString();
}

function tickDeclareBlock(parts: TickFunctionTunings): string {
  return `
DECLARE
  v_lock_id      CONSTANT BIGINT  := ${TICK_ADVISORY_LOCK_ID};
  v_max_parts    CONSTANT INT     := ${intLit(parts.maxPartitionsFanout)};
  v_max_passes   CONSTANT INT     := ${intLit(parts.maxPassesPerPartition)};
  v_max_pairs    CONSTANT INT     := ${intLit(parts.maxPairsPerPass)};
  v_base_radius  CONSTANT NUMERIC := ${numericLit(parts.baseRadius)};
  v_growth       CONSTANT NUMERIC := ${numericLit(parts.radiusGrowthPerSecond)};
  v_max_radius   CONSTANT NUMERIC := ${numericLit(parts.maxRadius)};
  v_bucket_w     CONSTANT NUMERIC := ${numericLit(parts.bucketWidth)};
  v_max_wait     CONSTANT INT     := ${intLit(parts.maxWaitSeconds)};
  v_matched_ret  CONSTANT INT     := ${intLit(parts.matchedRetentionSeconds)};
  v_sig          TEXT;
  v_matches      BIGINT;
  v_pass         INT;`.trim();
}

const TICK_BODY_BLOCK = `
BEGIN
  IF NOT pg_try_advisory_lock(v_lock_id) THEN RETURN; END IF;

  BEGIN
    FOR v_sig IN
      SELECT partition_signature
      FROM matchmaking_active_partitions
      ORDER BY first_seen_at
      LIMIT v_max_parts
    LOOP
      v_pass := 0;
      LOOP
        v_pass := v_pass + 1;
        SELECT COUNT(DISTINCT match_id) INTO v_matches
        FROM matchmaking_run_match_pass(
          v_sig, v_base_radius, v_growth, v_max_radius,
          v_max_pairs, v_bucket_w, NULL
        );
        IF v_matches = 0 OR v_pass >= v_max_passes THEN EXIT; END IF;
      END LOOP;
      IF v_max_wait > 0 THEN
        PERFORM matchmaking_sweep_expired(v_sig, v_max_wait, NULL);
      END IF;
    END LOOP;

    DELETE FROM matchmaking_active_partitions ap
    WHERE NOT EXISTS (
      SELECT 1 FROM matchmaking_waiting w
      WHERE w.partition_signature = ap.partition_signature
    );

    IF v_matched_ret > 0 THEN
      PERFORM matchmaking_sweep_matched(v_matched_ret, NULL);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(v_lock_id);
    RAISE;
  END;

  PERFORM pg_advisory_unlock(v_lock_id);
END;
`.trim();

type TickFunctionTunings = {
  readonly baseRadius: number;
  readonly radiusGrowthPerSecond: number;
  readonly maxRadius: number;
  readonly bucketWidth: number;
  readonly maxPairsPerPass: number;
  readonly maxWaitSeconds: number;
  readonly matchedRetentionSeconds: number;
  readonly maxPartitionsFanout: number;
  readonly maxPassesPerPartition: number;
};

export function buildCreateTickFunctionSql(parts: TickFunctionTunings): string {
  return `
CREATE OR REPLACE FUNCTION matchmaking_tick() RETURNS VOID
LANGUAGE plpgsql AS $matchmaking_tick$
${tickDeclareBlock(parts)}
${TICK_BODY_BLOCK}
$matchmaking_tick$;
`.trim();
}

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
