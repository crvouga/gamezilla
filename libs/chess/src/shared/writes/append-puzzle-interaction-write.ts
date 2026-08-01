import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  ChessPuzzleInteractionCol,
} from '@libs/db/shared/chess-tables';
import { sqlMap } from '@pkgs/sql-map';

import type { SqlClient } from '@pkgs/sql-client/interface';

import type { ChessPuzzleInteractionKind } from '../chess-puzzle-interaction-entities';

export type AppendPuzzleInteractionInput = {
  readonly ownerId: string;
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly kind: ChessPuzzleInteractionKind;
  readonly solveIdx: number;
  readonly uci?: string | null;
  readonly correct?: boolean | null;
  readonly ratingBefore?: number;
  readonly ratingAfter?: number;
};

export async function appendPuzzleInteractionRowSql(
  db: SqlClient,
  input: AppendPuzzleInteractionInput
): Promise<void> {
  const id = crypto.randomUUID();
  const at = new Date().toISOString();
  const correct =
    input.correct === null || input.correct === undefined
      ? null
      : input.correct
        ? 1
        : 0;
  await db.run(
    sqlMap({
      insertInto: CHESS_PUZZLE_INTERACTIONS_TABLE.tableName,
      values: {
        [ChessPuzzleInteractionCol.id]: id,
        [ChessPuzzleInteractionCol.ownerId]: input.ownerId,
        [ChessPuzzleInteractionCol.puzzleId]: input.puzzleId,
        [ChessPuzzleInteractionCol.puzzleRating]: input.puzzleRating,
        [ChessPuzzleInteractionCol.kind]: input.kind,
        [ChessPuzzleInteractionCol.solveIdx]: input.solveIdx,
        [ChessPuzzleInteractionCol.uci]: input.uci ?? null,
        [ChessPuzzleInteractionCol.correct]: correct,
        [ChessPuzzleInteractionCol.ratingBefore]: input.ratingBefore ?? 0,
        [ChessPuzzleInteractionCol.ratingAfter]: input.ratingAfter ?? 0,
        [ChessPuzzleInteractionCol.at]: at,
      },
    })
  );
}
