/**
 * Owns the `matchmaking_queue` table and the PL/pgSQL functions that drive
 * matching end to end. Idempotent: safe to call on every boot.
 *
 * Schema invariants:
 *   - No game-specific columns. Everything app-shaped lives in JSONB:
 *     `data` (the player's attributes, branded `AttributeState` in JS) and
 *     `formulas` (the player's ordered list of acceptance criteria, each a
 *     `DistanceFormula`).
 *   - Matching is per-row: each waiting row carries its own `formulas`. Two
 *     players match iff there exists a pair `(fa, fb)` from their formula
 *     lists such that both formulas accept the pair (partition compatibility
 *     and distance within each side's radius). This makes matching
 *     asymmetric — A may use a strict rating-only formula while B uses a
 *     looser one with a game partition.
 *   - When a pair matches, the function mints a fresh `match_id` UUID and
 *     writes it on both rows. Callers poll `status(playerId)` and use the
 *     emitted `matchId` to spin up the match (e.g. a Durable Object) out of
 *     band.
 *
 * Pushing the pairing algorithm into Postgres keeps the app layer stateless:
 * `runMatchPass` is a single function call and the FOR UPDATE SKIP LOCKED
 * snapshot, greedy FIFO pairing, mutual-formula validation, status flip, and
 * row return all happen inside one server-side transaction.
 */

import type { Pool } from 'pg';
import { createPgSqlClient } from './pg-adapter';
import type { SqlClient } from './sql-client';

export type MigrateArgs =
  | { readonly pool: Pool; readonly sqlClient?: never }
  | { readonly sqlClient: SqlClient; readonly pool?: never };

// Drop the legacy `rating` column / index if a previous deploy created them
// — keeps `migrate()` idempotent across schema generations.
const DROP_LEGACY_COLUMN_SQL = `
ALTER TABLE IF EXISTS matchmaking_queue DROP COLUMN IF EXISTS rating
`.trim();

const DROP_LEGACY_INDEX_SQL = `
DROP INDEX IF EXISTS matchmaking_queue_status_rating_idx
`.trim();

// `gen_random_uuid()` is built into Postgres 13+ (no `pgcrypto` extension
// required) and is also available in PGlite.
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status    TEXT NOT NULL DEFAULT 'waiting',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data      JSONB NOT NULL DEFAULT '{}',
  formulas  JSONB NOT NULL DEFAULT '[]',
  match_id  UUID NULL
)
`.trim();

// Idempotent column adds so existing DBs gain the new columns without
// requiring a full table rebuild.
const ALTER_ADD_COLUMNS_SQL = `
ALTER TABLE matchmaking_queue
  ADD COLUMN IF NOT EXISTS formulas JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS match_id UUID NULL
`.trim();

// Covers the function's `WHERE status='waiting' ORDER BY joined_at ASC` scan.
const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_queue_status_joined_at_idx
  ON matchmaking_queue (status, joined_at)
`.trim();

// Lets `status(playerId)` quickly find the opponent rows by match_id.
const CREATE_MATCH_ID_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS matchmaking_queue_match_id_idx
  ON matchmaking_queue (match_id)
`.trim();

/**
 * Hard-equality filter: two players are compatible candidates only when they
 * agree on every partition attribute. Unlike `matchmaking_pair_distance`'s
 * categorical penalties (which the expanding radius eventually absorbs),
 * mismatched partition values are permanent. Use for game type, tournament
 * bracket, queue mode, region tier, etc.
 */
const CREATE_PAIR_COMPATIBLE_SQL = `
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

/**
 * Pure helper: computes the distance between two players' JSONB data blobs
 * under the supplied formula.
 *
 *   numeric:    weight * |a.value - b.value|
 *   categorical: penalty when a.value IS DISTINCT FROM b.value
 *
 * Missing numeric attrs raise — `Matchmaker.join` validates presence at JS
 * time, so seeing NULL here means a library invariant was violated.
 * Missing categorical attrs are allowed (counted as "different").
 *
 * Partition compatibility is enforced separately by
 * `matchmaking_pair_compatible` at candidate-selection time; this helper
 * only ranks already-compatible pairs.
 */
const CREATE_PAIR_DISTANCE_SQL = `
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
 * Mutual-acceptance check across two players' formula lists.
 *
 * Each player carries an ORDERED array of formulas — semantically an OR of
 * acceptance criteria. Two players match when there exists ANY pair
 * `(fa, fb)` in the Cartesian product of their formula lists such that:
 *   1. fa's partition accepts the pair (A's perspective)
 *   2. fb's partition accepts the pair (B's perspective)
 *   3. fa's distance fits in A's radius
 *   4. fb's distance fits in B's radius
 *
 * Distance is symmetric in (A, B), so we compute it once per formula and
 * compare against each side's own radius.
 */
const CREATE_PAIR_MATCH_SQL = `
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

// Adding/removing parameters changes the function signature, which
// `CREATE OR REPLACE` cannot do — Postgres treats it as a new overload.
// Drop every prior known signature first so each `migrate()` run leaves
// exactly one version installed.
const DROP_RUN_MATCH_PASS_LEGACY_A_SQL = `
DROP FUNCTION IF EXISTS matchmaking_run_match_pass(
  INT, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB, TIMESTAMPTZ
)
`.trim();

const DROP_RUN_MATCH_PASS_LEGACY_B_SQL = `
DROP FUNCTION IF EXISTS matchmaking_run_match_pass(
  INT, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB, JSONB, TIMESTAMPTZ
)
`.trim();

/**
 * One full match pass, server-side.
 *
 * Algorithm:
 *   1. Snapshot every `status='waiting'` row in FIFO order, locking with
 *      `FOR UPDATE SKIP LOCKED` so concurrent passes can't fight.
 *   2. Each player gets an expanding radius:
 *        r = LEAST(base + max(0, wait_seconds) * growth, max)
 *   3. Greedy FIFO seeding: the oldest unmatched waiter is the seed.
 *      Scan remaining unmatched candidates in `joined_at` order. The first
 *      candidate for which `matchmaking_pair_match` returns true is the
 *      pair. Each player's own formulas + radius are used for their side of
 *      the check, so matching is asymmetric.
 *   4. Mint a fresh `match_id` UUID, mark both rows `matched`, emit one
 *      row per player tagged with that `match_id`.
 *
 * matchSize is fixed at 2 — per-player formulas don't compose transitively
 * into N-player groups. Multi-player rooms can be assembled by the caller
 * out of band using the `match_id`.
 *
 * `p_now` lets tests inject a synthetic clock; production passes NULL and
 * the DB's `now()` wins.
 */
const CREATE_RUN_MATCH_PASS_SQL = `
CREATE OR REPLACE FUNCTION matchmaking_run_match_pass(
  p_base_radius    NUMERIC,
  p_growth_per_sec NUMERIC,
  p_max_radius     NUMERIC,
  p_now            TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  match_id  UUID,
  player_id UUID,
  joined_at TIMESTAMPTZ,
  data      JSONB
)
LANGUAGE plpgsql AS $matchmaking_run_match_pass$
DECLARE
  v_now         TIMESTAMPTZ := COALESCE(p_now, now());
  v_ids         UUID[];
  v_joined_ats  TIMESTAMPTZ[];
  v_radii       NUMERIC[];
  v_datas       JSONB[];
  v_formulas    JSONB[];
  v_taken       BOOLEAN[];
  v_n           INT;
  v_i           INT;
  v_j           INT;
  v_match_id    UUID;
BEGIN
  WITH locked AS (
    SELECT q.id, q.joined_at, q.data, q.formulas,
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
    array_agg(locked.joined_at ORDER BY locked.joined_at ASC),
    array_agg(locked.radius    ORDER BY locked.joined_at ASC),
    array_agg(locked.data      ORDER BY locked.joined_at ASC),
    array_agg(locked.formulas  ORDER BY locked.joined_at ASC)
  INTO v_ids, v_joined_ats, v_radii, v_datas, v_formulas
  FROM locked;

  IF v_ids IS NULL THEN RETURN; END IF;
  v_n := array_length(v_ids, 1);
  IF v_n < 2 THEN RETURN; END IF;
  v_taken := array_fill(FALSE, ARRAY[v_n]);

  FOR v_i IN 1..v_n - 1 LOOP
    IF v_taken[v_i] THEN CONTINUE; END IF;

    FOR v_j IN v_i + 1..v_n LOOP
      IF v_taken[v_j] THEN CONTINUE; END IF;
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
      WHERE id = ANY(ARRAY[v_ids[v_i], v_ids[v_j]]);

      RETURN QUERY
      SELECT v_match_id, q.id, q.joined_at, q.data
      FROM matchmaking_queue q
      WHERE q.id = ANY(ARRAY[v_ids[v_i], v_ids[v_j]])
      ORDER BY q.joined_at;

      EXIT;
    END LOOP;
  END LOOP;
END;
$matchmaking_run_match_pass$;
`.trim();

const DDL_STATEMENTS = [
  DROP_LEGACY_COLUMN_SQL,
  DROP_LEGACY_INDEX_SQL,
  CREATE_TABLE_SQL,
  ALTER_ADD_COLUMNS_SQL,
  CREATE_INDEX_SQL,
  CREATE_MATCH_ID_INDEX_SQL,
  CREATE_PAIR_DISTANCE_SQL,
  CREATE_PAIR_COMPATIBLE_SQL,
  CREATE_PAIR_MATCH_SQL,
  DROP_RUN_MATCH_PASS_LEGACY_A_SQL,
  DROP_RUN_MATCH_PASS_LEGACY_B_SQL,
  CREATE_RUN_MATCH_PASS_SQL,
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
