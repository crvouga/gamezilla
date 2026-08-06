import {
  appendPuzzleInteractionMutation,
  upsertPuzzleProfileMutation,
} from '../../shared/mutations/chess-mutations';
import type { MutationClient } from '@pkgs/mutations/client/create-mutation-client';

import type { ChessPuzzleInteractionRow } from '../../shared/chess-puzzle-interaction-entities';
import {
  deriveOutcomeScore,
  isPlayClosed,
  sliceCurrentPlay,
} from '../../shared/chess-puzzle-derive';
import { updatePuzzleRating } from '../../shared/chess-puzzle-rating';
import { type AppendPuzzleInteractionInput } from '../../shared/writes/append-puzzle-interaction-write';
import { type UpsertPuzzleProfileInput } from '../../shared/writes/upsert-puzzle-profile-write';

function nowIso(): string {
  return new Date().toISOString();
}

export async function appendPuzzleInteractionRow(
  mutationClient: MutationClient,
  args: AppendPuzzleInteractionInput
): Promise<void> {
  const result = await mutationClient.mutate(appendPuzzleInteractionMutation, {
    interactionId: crypto.randomUUID(),
    ...args,
  });
  if (!result.ok) throw new Error(result.failures[0]?.message);
}

async function upsertPuzzleProfile(
  mutationClient: MutationClient,
  args: UpsertPuzzleProfileInput
): Promise<void> {
  const result = await mutationClient.mutate(upsertPuzzleProfileMutation, args);
  if (!result.ok) throw new Error(result.failures[0]?.message);
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
  mutationClient: MutationClient,
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
  await appendPuzzleInteractionRow(mutationClient, {
    ownerId: args.ownerId,
    puzzleId: args.puzzleId,
    puzzleRating: args.puzzleRating,
    kind: args.terminalKind,
    solveIdx: args.solveIdx,
    ratingBefore: ratings.ratingBefore,
    ratingAfter: ratings.ratingAfter,
  });
  await upsertPuzzleProfile(mutationClient, {
    ownerId: args.ownerId,
    rating: ratings.ratingAfter,
    ratingDeviation: ratings.ratingDeviation,
    lastInteractionAt: ratings.at,
  });
}
