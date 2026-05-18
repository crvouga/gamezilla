/**
 * Owns the `matchmaking_queue` table **and** the `matchmaking_run_match_pass`
 * PL/pgSQL function end to end. Idempotent: safe to call on every boot.
 *
 * Pushing the pairing algorithm into Postgres keeps the app layer stateless —
 * `runMatchPass` is a single function call and the FOR UPDATE SKIP LOCKED
 * snapshot, greedy FIFO pairing, mutual-radius validation, status flip, and
 * row return all happen inside one server-side transaction.
 *
 * Callers may pass either a raw `pg.Pool` or any {@link SqlClient} (handy for
 * tests that drive PGlite, or for migration runners that already hold a
 * transaction-scoped client).
 */

import type { Pool } from 'pg';
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';

export type MigrateArgs =
  | { readonly pool: Pool; readonly sqlClient?: never }
  | { readonly sqlClient: SqlClient; readonly pool?: never };

// `gen_random_uuid()` is built into Postgres 13+ (no `pgcrypto` extension
// required) and is also available in PGlite, so the DDL stays portable
// without any `CREATE EXTENSION` step.
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating    INT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'waiting',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data      JSONB NOT NULL DEFAULT '{}'
)
`.trim();

const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_queue_status_rating_idx
  ON matchmaking_queue (status, rating)
`.trim();

/**
 * Stored procedure that runs one full match pass entirely server-side.
 *
 * Algorithm (matches the original JS reference, now expressed in PL/pgSQL):
 *   1. Snapshot every `status='waiting'` row in FIFO order, locking them with
 *      `FOR UPDATE SKIP LOCKED` so concurrent passes can't fight over the
 *      same players.
 *   2. Each player gets an expanding radius:
 *        r = LEAST(base + max(0, wait_seconds) * growth, max)
 *   3. Greedy FIFO seeding: the oldest unmatched waiter is the seed. The
 *      remaining unmatched candidates are ranked by absolute rating distance
 *      from the seed; for each candidate, accept it iff its rating fits
 *      inside `LEAST(member_radius, candidate_radius)` against *every* member
 *      already in the group. Stop once the group reaches `p_match_size`.
 *   4. Mark the group as `matched` and emit one row per player tagged with a
 *      sequential `group_seq` so the caller can re-group rows client-side.
 *
 * `p_now` lets tests inject a synthetic clock without sleeping or fudging
 * `joined_at`. In production, callers pass NULL and the DB's `now()` wins.
 */
const CREATE_FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_run_match_pass(
  p_match_size     INT,
  p_base_radius    NUMERIC,
  p_growth_per_sec NUMERIC,
  p_max_radius     NUMERIC,
  p_now            TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  group_seq INT,
  player_id UUID,
  rating    INT,
  joined_at TIMESTAMPTZ,
  data      JSONB
)
LANGUAGE plpgsql AS $matchmaking_run_match_pass$
DECLARE
  v_now         TIMESTAMPTZ := COALESCE(p_now, now());
  v_ids         UUID[];
  v_ratings     NUMERIC[];
  v_radii       NUMERIC[];
  v_taken       BOOLEAN[];
  v_n           INT;
  v_i           INT;
  v_j           INT;
  v_k           INT;
  v_group_idx   INT[];
  v_group_size  INT;
  v_fits        BOOLEAN;
  v_ranked      INT[];
  v_group_uuids UUID[];
  v_group_seq   INT := 0;
BEGIN
  WITH locked AS (
    SELECT q.id, q.rating, q.joined_at,
           LEAST(
             p_base_radius +
               GREATEST(EXTRACT(EPOCH FROM (v_now - q.joined_at)), 0)
                 * p_growth_per_sec,
             p_max_radius
           )::NUMERIC AS radius
    FROM matchmaking_queue q
    WHERE q.status = 'waiting'
    ORDER BY q.joined_at ASC
    FOR UPDATE SKIP LOCKED
  )
  SELECT
    array_agg(locked.id        ORDER BY locked.joined_at ASC),
    array_agg(locked.rating::NUMERIC ORDER BY locked.joined_at ASC),
    array_agg(locked.radius    ORDER BY locked.joined_at ASC)
  INTO v_ids, v_ratings, v_radii
  FROM locked;

  IF v_ids IS NULL THEN RETURN; END IF;
  v_n := array_length(v_ids, 1);
  IF v_n < p_match_size THEN RETURN; END IF;
  v_taken := array_fill(FALSE, ARRAY[v_n]);

  FOR v_i IN 1..v_n LOOP
    IF v_taken[v_i] THEN CONTINUE; END IF;

    SELECT array_agg(j ORDER BY ABS(v_ratings[j] - v_ratings[v_i]) ASC, j ASC)
    INTO v_ranked
    FROM generate_series(1, v_n) AS j
    WHERE j <> v_i AND NOT v_taken[j];

    v_group_idx  := ARRAY[v_i];
    v_group_size := 1;

    IF v_ranked IS NOT NULL THEN
      FOREACH v_j IN ARRAY v_ranked LOOP
        v_fits := TRUE;
        FOR v_k IN 1..v_group_size LOOP
          IF ABS(v_ratings[v_group_idx[v_k]] - v_ratings[v_j]) >
             LEAST(v_radii[v_group_idx[v_k]], v_radii[v_j]) THEN
            v_fits := FALSE;
            EXIT;
          END IF;
        END LOOP;
        IF v_fits THEN
          v_group_idx  := v_group_idx || v_j;
          v_group_size := v_group_size + 1;
          EXIT WHEN v_group_size >= p_match_size;
        END IF;
      END LOOP;
    END IF;

    IF v_group_size < p_match_size THEN CONTINUE; END IF;

    v_group_uuids := ARRAY[]::UUID[];
    FOREACH v_j IN ARRAY v_group_idx LOOP
      v_taken[v_j]   := TRUE;
      v_group_uuids  := v_group_uuids || v_ids[v_j];
    END LOOP;

    v_group_seq := v_group_seq + 1;

    UPDATE matchmaking_queue
    SET status = 'matched'
    WHERE id = ANY(v_group_uuids);

    RETURN QUERY
    SELECT v_group_seq, q.id, q.rating, q.joined_at, q.data
    FROM matchmaking_queue q
    WHERE q.id = ANY(v_group_uuids)
    ORDER BY q.joined_at;
  END LOOP;
END;
$matchmaking_run_match_pass$;
`.trim();

const DDL_STATEMENTS = [
  CREATE_TABLE_SQL,
  CREATE_INDEX_SQL,
  CREATE_FUNCTION_SQL,
] as const;

function resolveSqlClient(args: MigrateArgs): SqlClient {
  if (args.sqlClient !== undefined) return args.sqlClient;
  return createPgSqlClient(args.pool);
}

export async function migrate(args: MigrateArgs): Promise<void> {
  const sqlClient = resolveSqlClient(args);
  for (const statement of DDL_STATEMENTS) {
    await sqlClient.query(statement);
  }
}
