import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

export type UpsertPuzzleProfileInput = {
  readonly ownerId: string;
  readonly rating: number;
  readonly ratingDeviation: number;
  readonly lastInteractionAt: string;
};

export class UpsertPuzzleProfileWrite {
  constructor(private readonly db: SqlClient) {}

  async upsertRow(input: UpsertPuzzleProfileInput): Promise<void> {
    const existing = await this.db.query(
      sql<{ readonly id: string }>`
        SELECT id
        FROM chess_puzzle_profiles
        WHERE id = ${input.ownerId}
        LIMIT 1
      `
    );
    if (existing.length > 0) {
      await this.#updateProfileRow(input);
    } else {
      await this.#insertProfileRow(input);
    }
  }

  async #updateProfileRow(input: UpsertPuzzleProfileInput): Promise<void> {
    await this.db.run(sql<void>`
      UPDATE chess_puzzle_profiles
      SET
        rating = ${input.rating},
        rating_deviation = ${input.ratingDeviation},
        last_interaction_at = ${input.lastInteractionAt}
      WHERE id = ${input.ownerId}
    `);
  }

  async #insertProfileRow(input: UpsertPuzzleProfileInput): Promise<void> {
    await this.db.run(sql<void>`
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
}
