import { runClientWrite } from '@pkgs/write/client/run-client-write';
import type { WriteContext } from '@pkgs/write/shared/write-context';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { ChessPuzzleInteractionRow } from '../../shared/chess-puzzle-interaction-entities';
import {
  deriveOutcomeScore,
  isPlayClosed,
  sliceCurrentPlay,
} from '../../shared/chess-puzzle-derive';
import { updatePuzzleRating } from '../../shared/chess-puzzle-rating';
import {
  appendPuzzleInteractionWrite,
  type AppendPuzzleInteractionInput,
} from '../../shared/writes/append-puzzle-interaction-write';
import {
  upsertPuzzleProfileWrite,
  type UpsertPuzzleProfileInput,
} from '../../shared/writes/upsert-puzzle-profile-write';

function nowIso(): string {
  return new Date().toISOString();
}

export async function appendPuzzleInteractionRow(
  sql: SqlClient,
  writeContext: WriteContext,
  args: AppendPuzzleInteractionInput
): Promise<void> {
  await runClientWrite(appendPuzzleInteractionWrite, writeContext, args, sql);
}

async function upsertPuzzleProfileRow(
  sql: SqlClient,
  writeContext: WriteContext,
  args: UpsertPuzzleProfileInput
): Promise<void> {
  await runClientWrite(upsertPuzzleProfileWrite, writeContext, args, sql);
}

function computeFinalizeRatings(args: {
  puzzleId: string;
  puzzleRating: number;
  solveIdx: number;
  interactions: readonly ChessPuzzleInteractionRow[];
  terminalKind: 'solved' | 'abandoned';
  profileRating: number;
  profileRd: number;
}): {
  ratingBefore: number;
  ratingAfter: number;
  ratingDeviation: number;
  at: string;
} {
  const play = sliceCurrentPlay(args.interactions, args.puzzleId);
  const at = nowIso();
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
      at,
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
  return {
    ratingBefore,
    ratingAfter: updated.rating,
    ratingDeviation: updated.ratingDeviation,
    at,
  };
}

/** Client orchestration: append terminal interaction, then upsert profile. */
export async function finalizePuzzlePlayWithProfile(
  sql: SqlClient,
  writeContext: WriteContext,
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
  const ratings = computeFinalizeRatings(args);
  await appendPuzzleInteractionRow(sql, writeContext, {
    ownerId: args.ownerId,
    puzzleId: args.puzzleId,
    puzzleRating: args.puzzleRating,
    kind: args.terminalKind,
    solveIdx: args.solveIdx,
    ratingBefore: ratings.ratingBefore,
    ratingAfter: ratings.ratingAfter,
  });
  await upsertPuzzleProfileRow(sql, writeContext, {
    ownerId: args.ownerId,
    rating: ratings.ratingAfter,
    ratingDeviation: ratings.ratingDeviation,
    lastInteractionAt: ratings.at,
  });
}
