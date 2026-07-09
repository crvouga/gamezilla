import type { SqlClient } from '@pkgs/sql-client/interface';

import type {
  ChessPuzzleInteractionKind,
  ChessPuzzleInteractionRow,
} from '../../shared/chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLE_PROFILES_TABLE,
  ChessPuzzleInteractionCol,
  ChessPuzzleProfileCol,
} from '../../shared/sync-tables';
import { isPlayClosed } from '../../shared/chess-puzzle-derive';
import {
  deriveOutcomeScore,
  sliceCurrentPlay,
} from '../../shared/chess-puzzle-derive';
import { updatePuzzleRating } from '../../shared/chess-puzzle-rating';

function nowIso(): string {
  return new Date().toISOString();
}

export async function appendPuzzleInteractionRow(
  sql: SqlClient,
  args: {
    ownerId: string;
    puzzleId: string;
    puzzleRating: number;
    kind: ChessPuzzleInteractionKind;
    solveIdx: number;
    uci?: string | null;
    correct?: boolean | null;
    ratingBefore?: number;
    ratingAfter?: number;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  const at = nowIso();
  await sql.run(
    `INSERT INTO ${CHESS_PUZZLE_INTERACTIONS_TABLE.tableName}
     (${ChessPuzzleInteractionCol.id}, ${ChessPuzzleInteractionCol.ownerId},
      ${ChessPuzzleInteractionCol.puzzleId}, ${ChessPuzzleInteractionCol.puzzleRating},
      ${ChessPuzzleInteractionCol.kind}, ${ChessPuzzleInteractionCol.solveIdx},
      ${ChessPuzzleInteractionCol.uci}, ${ChessPuzzleInteractionCol.correct},
      ${ChessPuzzleInteractionCol.ratingBefore}, ${ChessPuzzleInteractionCol.ratingAfter},
      ${ChessPuzzleInteractionCol.at})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      args.ownerId,
      args.puzzleId,
      args.puzzleRating,
      args.kind,
      args.solveIdx,
      args.uci ?? null,
      args.correct === null || args.correct === undefined ? null : args.correct ? 1 : 0,
      args.ratingBefore ?? 0,
      args.ratingAfter ?? 0,
      at,
    ]
  );
}

async function upsertPuzzleProfileRow(
  sql: SqlClient,
  args: {
    ownerId: string;
    rating: number;
    ratingDeviation: number;
    lastInteractionAt: string;
  }
): Promise<void> {
  const { ownerId, rating, ratingDeviation, lastInteractionAt } = args;
  const existing = await sql.query<{ readonly n: number }>(
    `SELECT 1 AS n FROM ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     WHERE ${ChessPuzzleProfileCol.id} = ? LIMIT 1`,
    [ownerId]
  );
  if (existing.length > 0) {
    await sql.run(
      `UPDATE ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
       SET ${ChessPuzzleProfileCol.rating} = ?,
           ${ChessPuzzleProfileCol.ratingDeviation} = ?,
           ${ChessPuzzleProfileCol.lastInteractionAt} = ?
       WHERE ${ChessPuzzleProfileCol.id} = ?`,
      [rating, ratingDeviation, lastInteractionAt, ownerId]
    );
    return;
  }
  await sql.run(
    `INSERT INTO ${CHESS_PUZZLE_PROFILES_TABLE.tableName}
     (${ChessPuzzleProfileCol.id}, ${ChessPuzzleProfileCol.ownerId},
      ${ChessPuzzleProfileCol.rating}, ${ChessPuzzleProfileCol.ratingDeviation},
      ${ChessPuzzleProfileCol.lastInteractionAt})
     VALUES (?, ?, ?, ?, ?)`,
    [ownerId, ownerId, rating, ratingDeviation, lastInteractionAt]
  );
}

export async function finalizePuzzlePlayWithProfile(
  sql: SqlClient,
  args: {
    ownerId: string;
    puzzleId: string;
    puzzleRating: number;
    solveIdx: number;
    interactions: readonly ChessPuzzleInteractionRow[];
    terminalKind: 'solved' | 'abandoned';
    profileRating: number;
    profileRd: number;
  }
): Promise<void> {
  if (isPlayClosed(args.interactions, args.puzzleId)) return;
  const play = sliceCurrentPlay(args.interactions, args.puzzleId);
  const closed = [
    ...play,
    {
      puzzleId: args.puzzleId,
      kind: args.terminalKind,
      solveIdx: args.solveIdx,
      uci: null,
      correct: null,
      puzzleRating: args.puzzleRating,
      ratingBefore: 0,
      ratingAfter: 0,
      at: nowIso(),
    },
  ];
  const ratingBefore = args.profileRating > 0 ? args.profileRating : 1200;
  const rdBefore = args.profileRd > 0 ? args.profileRd : 350;
  const updated = updatePuzzleRating({
    playerRating: ratingBefore,
    playerRd: rdBefore,
    puzzleRating: args.puzzleRating,
    score: deriveOutcomeScore(closed),
  });
  const at = nowIso();
  await appendPuzzleInteractionRow(sql, {
    ownerId: args.ownerId,
    puzzleId: args.puzzleId,
    puzzleRating: args.puzzleRating,
    kind: args.terminalKind,
    solveIdx: args.solveIdx,
    ratingBefore,
    ratingAfter: updated.rating,
  });
  await upsertPuzzleProfileRow(sql, {
    ownerId: args.ownerId,
    rating: updated.rating,
    ratingDeviation: updated.ratingDeviation,
    lastInteractionAt: at,
  });
}
