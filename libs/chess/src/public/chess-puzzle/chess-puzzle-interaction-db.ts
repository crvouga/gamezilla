import type { Clock } from '@pkgs/clock';
import type { MutationClient } from '@pkgs/sync-engine/client';
import type { CreateId } from '@pkgs/uuid';
import { appendPuzzleInteractionMutation } from '../../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { upsertPuzzleProfileMutation } from '../../use-cases/upsert-puzzle-profile/shared/upsert-puzzle-profile-mutation';
import { isPlayClosed } from '../chess-puzzle-derive';
import type { ChessPuzzleInteractionRow } from '../chess-puzzle-interaction-entities';
import {
  PUZZLE_PROFILE_RD_STUB,
  projectPuzzleEloFromInteractions,
} from '../chess-puzzle-rating';
import type { AppendPuzzleInteractionInput } from '../writes/append-puzzle-interaction-write';
import type { UpsertPuzzleProfileInput } from '../writes/upsert-puzzle-profile-write';

function mutationRejected(
  mutation: string,
  failures: readonly { readonly message?: string | undefined }[]
): Error {
  const detail = failures
    .map((f) => f.message)
    .filter((m): m is string => typeof m === 'string' && m.length > 0)
    .join('; ');
  return new Error(
    `${mutation} rejected${detail.length > 0 ? `: ${detail}` : ''}`
  );
}

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
    if (!result.ok) {
      throw mutationRejected('appendPuzzleInteraction', result.failures);
    }
  }

  async #upsertPuzzleProfile(args: UpsertPuzzleProfileInput): Promise<void> {
    const result = await this.mutationClient.mutate(
      upsertPuzzleProfileMutation,
      args
    );
    if (!result.ok) {
      throw mutationRejected('upsertPuzzleProfile', result.failures);
    }
  }

  /**
   * Append terminal attempt fact, then upsert profile cache from a full
   * history Elo fold (formula is the source of truth).
   */
  async finalizePlayWithProfile(args: {
    ownerId: string;
    puzzleId: string;
    puzzleRating: number;
    solveIdx: number;
    interactions: readonly ChessPuzzleInteractionRow[];
    allInteractions: readonly ChessPuzzleInteractionRow[];
    terminalKind: 'solved' | 'abandoned';
    clock: Clock;
  }): Promise<void> {
    if (isPlayClosed(args.interactions, args.puzzleId)) return;
    const at = nowIso(args.clock);
    const terminal: ChessPuzzleInteractionRow = {
      puzzleId: args.puzzleId,
      kind: args.terminalKind,
      solveIdx: args.solveIdx,
      uci: null,
      correct: null,
      puzzleRating: args.puzzleRating,
      at,
    };
    await this.appendRow({
      ownerId: args.ownerId,
      puzzleId: args.puzzleId,
      puzzleRating: args.puzzleRating,
      kind: args.terminalKind,
      solveIdx: args.solveIdx,
    });
    const projected = projectPuzzleEloFromInteractions([
      ...args.allInteractions,
      terminal,
    ]);
    await this.#upsertPuzzleProfile({
      ownerId: args.ownerId,
      rating: projected.rating,
      ratingDeviation: PUZZLE_PROFILE_RD_STUB,
      lastInteractionAt: at,
    });
  }
}
