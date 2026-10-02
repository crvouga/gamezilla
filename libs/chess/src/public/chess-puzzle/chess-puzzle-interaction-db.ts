import type { MutationClient } from '@pkgs/sync-engine/client';
import type { CreateId } from '@pkgs/uuid';
import { appendPuzzleInteractionMutation } from '../../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { ratePuzzleAttemptMutation } from '../../use-cases/rate-puzzle-attempt/shared/rate-puzzle-attempt-mutation';
import type { ChessPuzzleOutcomeKind } from '../chess-puzzle-interaction-entities';
import type { AppendPuzzleInteractionInput } from '../writes/append-puzzle-interaction-write';

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

export type FinalizePlayInput = {
  readonly attemptKey: string;
  readonly ownerId: string;
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly puzzleRatingDeviation: number;
  readonly solveIdx: number;
  readonly terminalKind: ChessPuzzleOutcomeKind;
  readonly scorePermille: 0 | 500 | 1000;
};

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

  /**
   * §8: the attempt, not a rating. `ratePuzzleAttempt` derives the new
   * profile inside the transaction, so the optimistic local value and the
   * server's authoritative one come from the same definition.
   */
  async #rateAttempt(args: {
    attemptKey: string;
    solveIdx: number;
    ownerId: string;
    puzzleId: string;
    puzzleRating: number;
    puzzleRatingDeviation: number;
    outcome: ChessPuzzleOutcomeKind;
    scorePermille: number;
  }): Promise<void> {
    const result = await this.mutationClient.mutate(
      ratePuzzleAttemptMutation,
      args
    );
    if (!result.ok) {
      throw mutationRejected('ratePuzzleAttempt', result.failures);
    }
  }

  /**
   * Result, rating, and queued upload commit together. A repeat attempt on
   * an already-rated puzzle still records its outcome; the mutation leaves
   * the first rating alone (§8 / §9 exhausted pool).
   */
  async finalizeRatedAttempt(args: FinalizePlayInput): Promise<void> {
    await this.#rateAttempt({
      attemptKey: args.attemptKey,
      solveIdx: args.solveIdx,
      ownerId: args.ownerId,
      puzzleId: args.puzzleId,
      puzzleRating: args.puzzleRating,
      puzzleRatingDeviation: args.puzzleRatingDeviation,
      outcome: args.terminalKind,
      scorePermille: args.scorePermille,
    });
  }
}
