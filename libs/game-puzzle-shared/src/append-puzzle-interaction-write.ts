import type { Clock } from '@pkgs/clock-shared/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

import type { PuzzleInteractionKind } from './interaction-entities';

export type AppendPuzzleInteractionInput = {
  readonly ownerId: string;
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly kind: PuzzleInteractionKind;
  readonly solveIdx: number;
  readonly uci?: string | null;
  readonly correct?: boolean | null;
};

export class AppendPuzzleInteractionWrite {
  constructor(private readonly db: SqlClient) {}

  async appendRow(
    input: AppendPuzzleInteractionInput,
    createId: CreateId,
    now: Clock['now']
  ): Promise<void> {
    const id = createId();
    const at = new Date(now()).toISOString();
    const correct =
      input.correct === null || input.correct === undefined
        ? null
        : input.correct
          ? 1
          : 0;
    await this.db.run(sql<void>`
      INSERT INTO chess_puzzle_interactions (
        id,
        owner_id,
        puzzle_id,
        puzzle_rating,
        kind,
        solve_idx,
        uci,
        correct,
        at
      )
      VALUES (
        ${id},
        ${input.ownerId},
        ${input.puzzleId},
        ${input.puzzleRating},
        ${input.kind},
        ${input.solveIdx},
        ${input.uci ?? null},
        ${correct},
        ${at}
      )
    `);
  }
}
