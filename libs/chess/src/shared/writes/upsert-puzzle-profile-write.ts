import {
  CHESS_PUZZLE_PROFILES_TABLE,
  ChessPuzzleProfileCol,
} from '@libs/db/shared/chess-tables';
import { sqlMap } from '@pkgs/sql';
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
  await db.run(
    sqlMap({
      update: CHESS_PUZZLE_PROFILES_TABLE.tableName,
      set: {
        [ChessPuzzleProfileCol.rating]: input.rating,
        [ChessPuzzleProfileCol.ratingDeviation]: input.ratingDeviation,
        [ChessPuzzleProfileCol.lastInteractionAt]: input.lastInteractionAt,
      },
      where: ['=', ChessPuzzleProfileCol.id, input.ownerId],
    })
  );
}

async function insertProfileRow(
  db: SqlClient,
  input: UpsertPuzzleProfileInput
): Promise<void> {
  await db.run(
    sqlMap({
      insertInto: CHESS_PUZZLE_PROFILES_TABLE.tableName,
      values: {
        [ChessPuzzleProfileCol.id]: input.ownerId,
        [ChessPuzzleProfileCol.ownerId]: input.ownerId,
        [ChessPuzzleProfileCol.rating]: input.rating,
        [ChessPuzzleProfileCol.ratingDeviation]: input.ratingDeviation,
        [ChessPuzzleProfileCol.lastInteractionAt]: input.lastInteractionAt,
      },
    })
  );
}

export async function upsertPuzzleProfileRow(
  db: SqlClient,
  input: UpsertPuzzleProfileInput
): Promise<void> {
  const existing = await db.query(
    sqlMap({
      select: [ChessPuzzleProfileCol.id],
      from: CHESS_PUZZLE_PROFILES_TABLE.tableName,
      where: ['=', ChessPuzzleProfileCol.id, input.ownerId],
      limit: 1,
    })
  );
  if (existing.length > 0) {
    await updateProfileRow(db, input);
  } else {
    await insertProfileRow(db, input);
  }
}
