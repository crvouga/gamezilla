import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLE_PROFILES_TABLE,
} from '@libs/db/shared/chess-tables';
import { CHESS_RULES } from '@libs/chess/shared/rules/rules';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';

import type { ChessPuzzleInteractionRow } from '../../shared/chess-puzzle-interaction-entities';
import {
  deriveOutcomeScore,
  isPlayClosed,
  sliceCurrentPlay,
} from '../../shared/chess-puzzle-derive';
import { updatePuzzleRating } from '../../shared/chess-puzzle-rating';
import {
  appendPuzzleInteractionRowSql,
  type AppendPuzzleInteractionInput,
} from '../../shared/writes/append-puzzle-interaction-write';
import {
  upsertPuzzleProfileRow,
  type UpsertPuzzleProfileInput,
} from '../../shared/writes/upsert-puzzle-profile-write';

function nowIso(): string {
  return new Date().toISOString();
}

export async function appendPuzzleInteractionRow(
  sql: SqlClient,
  auth: AppRulesAuth,
  args: AppendPuzzleInteractionInput
): Promise<void> {
  await validatedWrite({
    sql,
    auth,
    rules: CHESS_RULES,
    beforeBatch: {
      rows: [
        {
          op: 'put',
          table: CHESS_PUZZLE_INTERACTIONS_TABLE.tableName,
          id: 'pending',
          values: {
            owner_id: args.ownerId,
          },
        },
      ],
    },
    fn: (tx) => appendPuzzleInteractionRowSql(tx, args),
  });
}

async function upsertPuzzleProfile(
  sql: SqlClient,
  auth: AppRulesAuth,
  args: UpsertPuzzleProfileInput
): Promise<void> {
  await validatedWrite({
    sql,
    auth,
    rules: CHESS_RULES,
    beforeBatch: {
      rows: [
        {
          op: 'put',
          table: CHESS_PUZZLE_PROFILES_TABLE.tableName,
          id: args.ownerId,
          values: {
            id: args.ownerId,
            owner_id: args.ownerId,
          },
        },
      ],
    },
    fn: (tx) => upsertPuzzleProfileRow(tx, args),
  });
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
  auth: AppRulesAuth,
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
  await appendPuzzleInteractionRow(sql, auth, {
    ownerId: args.ownerId,
    puzzleId: args.puzzleId,
    puzzleRating: args.puzzleRating,
    kind: args.terminalKind,
    solveIdx: args.solveIdx,
    ratingBefore: ratings.ratingBefore,
    ratingAfter: ratings.ratingAfter,
  });
  await upsertPuzzleProfile(sql, auth, {
    ownerId: args.ownerId,
    rating: ratings.ratingAfter,
    ratingDeviation: ratings.ratingDeviation,
    lastInteractionAt: ratings.at,
  });
}
