import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

export type UpsertPuzzleProfileInput = {
  readonly ownerId: string;
  readonly rating: number;
  readonly ratingDeviation: number;
  readonly lastInteractionAt: string;
};

async function updateProfileRow(
  db: SqlClient,
  input: UpsertPuzzleProfileInput
): Promise<void> {
  await db.run(sql<void>`
    UPDATE chess_puzzle_profiles
    SET
      rating = ${input.rating},
      rating_deviation = ${input.ratingDeviation},
      last_interaction_at = ${input.lastInteractionAt}
    WHERE id = ${input.ownerId}
  `);
}

async function insertProfileRow(
  db: SqlClient,
  input: UpsertPuzzleProfileInput
): Promise<void> {
  await db.run(sql<void>`
    INSERT INTO chess_puzzle_profiles (
      id,
      owner_id,
      rating,
      rating_deviation,
      last_interaction_at
    )
    VALUES (
      ${input.ownerId},
      ${input.ownerId},
      ${input.rating},
      ${input.ratingDeviation},
      ${input.lastInteractionAt}
    )
  `);
}

export async function upsertPuzzleProfileRow(
  db: SqlClient,
  input: UpsertPuzzleProfileInput
): Promise<void> {
  const existing = await db.query(
    sql<{ readonly id: string }>`
      SELECT id
      FROM chess_puzzle_profiles
      WHERE id = ${input.ownerId}
      LIMIT 1
    `
  );
  if (existing.length > 0) {
    await updateProfileRow(db, input);
  } else {
    await insertProfileRow(db, input);
  }
}
