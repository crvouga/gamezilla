/**
 * §8 rating reads for scenarios: the player's profile row and the rating
 * ledger, on the actor's own device and on the server. Scenarios assert the
 * server value is the one that survives, so both sides are readable.
 */

import { actorLocalSql } from '@libs/sim-harness/system/identity';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

export type PuzzleProfileRow = {
  readonly rating: number;
  readonly rating_deviation: number;
  readonly volatility_micros: number;
};

export type PuzzleRatingEventRow = {
  readonly puzzle_id: string;
  readonly outcome: string;
  readonly rating_before: number;
  readonly rating_after: number;
  readonly at: string;
};

async function selectProfile(
  db: Pick<SqlTx, 'query'>,
  ownerId: string
): Promise<PuzzleProfileRow | null> {
  const rows = await db.query(sql<PuzzleProfileRow>`
    SELECT rating, rating_deviation, volatility_micros
    FROM chess_puzzle_profiles
    WHERE owner_id = ${ownerId}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function selectRatingEvents(
  db: Pick<SqlTx, 'query'>,
  ownerId: string
): Promise<PuzzleRatingEventRow[]> {
  return db.query(sql<PuzzleRatingEventRow>`
    SELECT puzzle_id, outcome, rating_before, rating_after, at
    FROM chess_puzzle_rating_events
    WHERE owner_id = ${ownerId}
      AND deleted_at IS NULL
    ORDER BY at ASC, puzzle_id ASC
  `);
}

/** The actor's own (synced) profile row, or null before the first rating. */
export async function readLocalPuzzleProfile(
  s: ProductSim,
  actorId: string,
  ownerId: string
): Promise<PuzzleProfileRow | null> {
  const db = actorLocalSql(s, actorId);
  return db === null ? null : selectProfile(db, ownerId);
}

/** The authoritative profile row on the server. */
export function readServerPuzzleProfile(
  s: ProductSim,
  ownerId: string
): Promise<PuzzleProfileRow | null> {
  return selectProfile(s.sim.serverSql.sqlClient, ownerId);
}

export async function readLocalRatingEvents(
  s: ProductSim,
  actorId: string,
  ownerId: string
): Promise<PuzzleRatingEventRow[]> {
  const db = actorLocalSql(s, actorId);
  return db === null ? [] : selectRatingEvents(db, ownerId);
}

export function readServerRatingEvents(
  s: ProductSim,
  ownerId: string
): Promise<PuzzleRatingEventRow[]> {
  return selectRatingEvents(s.sim.serverSql.sqlClient, ownerId);
}
