import type { Clock } from '@pkgs/clock';
import type { MutationClient } from '@pkgs/sync-engine/client';
import type { CreateId } from '@pkgs/uuid';
import {
  deriveOutcomeScore,
  isPlayClosed,
  sliceCurrentPlay,
} from '../../shared/chess-puzzle-derive';

import type { ChessPuzzleInteractionRow } from '../../shared/chess-puzzle-interaction-entities';
import { updatePuzzleRating } from '../../shared/chess-puzzle-rating';
import {
  appendPuzzleInteractionMutation,
  upsertPuzzleProfileMutation,
} from '../../shared/mutations/chess-mutations';
import type { AppendPuzzleInteractionInput } from '../../shared/writes/append-puzzle-interaction-write';
import type { UpsertPuzzleProfileInput } from '../../shared/writes/upsert-puzzle-profile-write';

function nowIso(clock: Clock): string {
  return new Date(clock.now()).toISOString();
}

export async function appendPuzzleInteractionRow(
  mutationClient: MutationClient,
  args: AppendPuzzleInteractionInput,
  createId: CreateId
): Promise<void> {
  const result = await mutationClient.mutate(appendPuzzleInteractionMutation, {
    interactionId: createId(),
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
  clock: Clock;
}): {
  ratingBefore: number;
  ratingAfter: number;
  ratingDeviation: number;
  at: string;
} {
  const play = sliceCurrentPlay(args.interactions, args.puzzleId);
  const at = nowIso(args.clock);
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
    createId: CreateId;
    clock: Clock;
  }
): Promise<void> {
  if (isPlayClosed(args.interactions, args.puzzleId)) return;
  const ratings = computeFinalizeRatings(args);
  await appendPuzzleInteractionRow(
    mutationClient,
    {
      ownerId: args.ownerId,
      puzzleId: args.puzzleId,
      puzzleRating: args.puzzleRating,
      kind: args.terminalKind,
      solveIdx: args.solveIdx,
      ratingBefore: ratings.ratingBefore,
      ratingAfter: ratings.ratingAfter,
    },
    args.createId
  );
  await upsertPuzzleProfile(mutationClient, {
    ownerId: args.ownerId,
    rating: ratings.ratingAfter,
    ratingDeviation: ratings.ratingDeviation,
    lastInteractionAt: ratings.at,
  });
}
