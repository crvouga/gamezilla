import type { Clock } from '@pkgs/clock';
import type { MutationClient } from '@pkgs/sync-engine/client';
import type { CreateId } from '@pkgs/uuid';
import { appendPuzzleInteractionMutation } from '../../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { upsertPuzzleProfileMutation } from '../../use-cases/upsert-puzzle-profile/shared/upsert-puzzle-profile-mutation';
import {
  deriveOutcomeScore,
  isPlayClosed,
  sliceCurrentPlay,
} from '../chess-puzzle-derive';
import type { ChessPuzzleInteractionRow } from '../chess-puzzle-interaction-entities';
import { updatePuzzleRating } from '../chess-puzzle-rating';
import type { AppendPuzzleInteractionInput } from '../writes/append-puzzle-interaction-write';
import type { UpsertPuzzleProfileInput } from '../writes/upsert-puzzle-profile-write';

function nowIso(clock: Clock): string {
  return new Date(clock.now()).toISOString();
}

export class ChessPuzzleInteractionDb {
  constructor(
    private readonly mutationClient: MutationClient,
    private readonly createId: CreateId
  ) {}

  async appendRow(args: AppendPuzzleInteractionInput): Promise<void> {
    const result = await this.mutationClient.mutate(
      appendPuzzleInteractionMutation,
      {
        interactionId: this.createId(),
        ...args,
      }
    );
    if (!result.ok) throw new Error(result.failures[0]?.message);
  }

  async #upsertPuzzleProfile(args: UpsertPuzzleProfileInput): Promise<void> {
    const result = await this.mutationClient.mutate(
      upsertPuzzleProfileMutation,
      args
    );
    if (!result.ok) throw new Error(result.failures[0]?.message);
  }

  /** Client orchestration: append terminal interaction, then upsert profile. */
  async finalizePlayWithProfile(args: {
    ownerId: string;
    puzzleId: string;
    puzzleRating: number;
    solveIdx: number;
    interactions: readonly ChessPuzzleInteractionRow[];
    terminalKind: 'solved' | 'abandoned';
    profileRating: number;
    profileRd: number;
    clock: Clock;
  }): Promise<void> {
    if (isPlayClosed(args.interactions, args.puzzleId)) return;
    const ratings = this.#computeFinalizeRatings(args);
    await this.appendRow({
      ownerId: args.ownerId,
      puzzleId: args.puzzleId,
      puzzleRating: args.puzzleRating,
      kind: args.terminalKind,
      solveIdx: args.solveIdx,
      ratingBefore: ratings.ratingBefore,
      ratingAfter: ratings.ratingAfter,
    });
    await this.#upsertPuzzleProfile({
      ownerId: args.ownerId,
      rating: ratings.ratingAfter,
      ratingDeviation: ratings.ratingDeviation,
      lastInteractionAt: ratings.at,
    });
  }

  #computeFinalizeRatings(args: {
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
}
