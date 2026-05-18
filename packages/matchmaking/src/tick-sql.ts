/**
 * Builder for the PL/pgSQL `matchmaking_tick()` function. Lives in
 * its own file so `migrate-sql.ts` stays under the per-file line cap
 * — this is otherwise a pure data-bearing module (PL/pgSQL string
 * constants + simple value-to-SQL-literal helpers).
 *
 * Tunings (radius curve, sweep windows, per-pass cap, bucket width,
 * fan-out cap, active-partitions prune age + hard cap) are baked
 * directly into the function body at migrate time — no parameters,
 * no runtime overhead for tuning lookups, and the function signature
 * stays `() RETURNS VOID` so pg_cron just calls
 * `SELECT matchmaking_tick()`.
 *
 * Single-flight guard: `pg_try_advisory_lock(bigint)` on a stable
 * lock id (see {@link MATCHMAKING_TICK_ADVISORY_LOCK_ID} in
 * `migrate-sql.ts`). Concurrent invocations (overlapping cron ticks
 * under sustained load, or a manual JS `mm.tick()` racing cron) all
 * return immediately when the lock is held — defence in depth since
 * pg_cron itself does not skip overlapping invocations.
 *
 * Failure handling: every Postgres error inside the inner
 * `BEGIN..EXCEPTION` block unlocks the advisory lock and re-raises.
 * pg_cron captures the error in `cron.job_run_details`; the next
 * cron interval retries from scratch.
 *
 * @internal
 */

/**
 * Stable advisory lock id used by `matchmaking_tick()` (the cron-
 * driven SQL function defined below) AND by `Matchmaking.tick()`
 * (the JS driver) for their shared single-flight guard. Arbitrary
 * 64-bit constant; just needs to be unique within this database so
 * no unrelated caller collides. Changing this is a deployment
 * decision.
 */
export const MATCHMAKING_TICK_ADVISORY_LOCK_ID = '7723344891234567000';

const TICK_ADVISORY_LOCK_ID = MATCHMAKING_TICK_ADVISORY_LOCK_ID;

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
  v_ap_prune_age CONSTANT INT     := ${intLit(parts.activePartitionsPruneAgeSeconds)};
  v_ap_hard_cap  CONSTANT INT     := ${intLit(parts.activePartitionsHardCap)};
  v_part         RECORD;
  v_matches      BIGINT;
  v_pass         INT;
  v_ap_count     BIGINT;`.trim();
}

const TICK_BODY_BLOCK = `
BEGIN
  IF NOT pg_try_advisory_lock(v_lock_id) THEN RETURN; END IF;

  BEGIN
    FOR v_part IN
      SELECT partition_signature, group_size
      FROM matchmaking_active_partitions
      ORDER BY first_seen_at
      LIMIT v_max_parts
    LOOP
      v_pass := 0;
      LOOP
        v_pass := v_pass + 1;
        SELECT COUNT(DISTINCT match_id) INTO v_matches
        FROM matchmaking_run_match_pass(
          v_part.partition_signature,
          v_base_radius, v_growth, v_max_radius,
          v_max_pairs, v_bucket_w, v_part.group_size, NULL
        );
        IF v_matches = 0 OR v_pass >= v_max_passes THEN EXIT; END IF;
      END LOOP;
      IF v_max_wait > 0 THEN
        PERFORM matchmaking_sweep_expired(
          v_part.partition_signature, v_max_wait, NULL
        );
      END IF;
    END LOOP;

    DELETE FROM matchmaking_active_partitions ap
    WHERE first_seen_at < now() - make_interval(secs => v_ap_prune_age)
      AND NOT EXISTS (
        SELECT 1 FROM matchmaking_waiting w
        WHERE w.partition_signature = ap.partition_signature
          AND w.group_size = ap.group_size
      );

    DELETE FROM matchmaking_active_partitions ap
    WHERE NOT EXISTS (
      SELECT 1 FROM matchmaking_waiting w
      WHERE w.partition_signature = ap.partition_signature
        AND w.group_size = ap.group_size
    );

    SELECT COUNT(*) INTO v_ap_count FROM matchmaking_active_partitions;
    IF v_ap_count > v_ap_hard_cap THEN
      DELETE FROM matchmaking_active_partitions
      WHERE (partition_signature, group_size) IN (
        SELECT partition_signature, group_size
        FROM matchmaking_active_partitions
        ORDER BY first_seen_at ASC
        LIMIT v_ap_count - v_ap_hard_cap
      );
    END IF;

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

export type TickFunctionTunings = {
  readonly baseRadius: number;
  readonly radiusGrowthPerSecond: number;
  readonly maxRadius: number;
  readonly bucketWidth: number;
  readonly maxPairsPerPass: number;
  readonly maxWaitSeconds: number;
  readonly matchedRetentionSeconds: number;
  readonly maxPartitionsFanout: number;
  readonly maxPassesPerPartition: number;
  readonly activePartitionsPruneAgeSeconds: number;
  readonly activePartitionsHardCap: number;
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
