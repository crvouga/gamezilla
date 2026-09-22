import type { MutationClient } from '@pkgs/sync-engine/client';
import type { CreateId } from '@pkgs/uuid';
import { appendPuzzleInteractionMutation } from '../../use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation';
import { ratePuzzleAttemptMutation } from '../../use-cases/rate-puzzle-attempt/shared/rate-puzzle-attempt-mutation';
import {
  deriveOutcomeScore,
  hasPlayOutcome,
  sliceCurrentPlay,
} from '../chess-puzzle-derive';
import type {
  ChessPuzzleInteractionRow,
  ChessPuzzleOutcomeKind,
} from '../chess-puzzle-interaction-entities';
import { puzzleScorePermille } from '../chess-puzzle-rating';
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
  readonly ownerId: string;
  readonly puzzleId: string;
  readonly puzzleRating: number;
  readonly puzzleRatingDeviation: number;
  readonly solveIdx: number;
  readonly interactions: readonly ChessPuzzleInteractionRow[];
  readonly terminalKind: ChessPuzzleOutcomeKind;
  readonly wrongMove: boolean;
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
   * Append the play's rated outcome (at most once per play), then hand the
   * attempt to the rating mutation. A repeat attempt on an already-rated
   * puzzle still records the outcome row; the mutation leaves the rating
   * alone (§8 / §9 exhausted pool).
   */
  async finalizeRatedAttempt(args: FinalizePlayInput): Promise<void> {
    if (hasPlayOutcome(args.interactions, args.puzzleId)) return;
    const terminal: ChessPuzzleInteractionRow = {
      puzzleId: args.puzzleId,
      kind: args.terminalKind,
      solveIdx: args.solveIdx,
      uci: null,
      correct: null,
      puzzleRating: args.puzzleRating,
      at: '',
    };
    await this.appendRow({
      ownerId: args.ownerId,
      puzzleId: args.puzzleId,
      puzzleRating: args.puzzleRating,
      kind: args.terminalKind,
      solveIdx: args.solveIdx,
    });
    await this.#rateAttempt({
      ownerId: args.ownerId,
      puzzleId: args.puzzleId,
      puzzleRating: args.puzzleRating,
      puzzleRatingDeviation: args.puzzleRatingDeviation,
      outcome: args.terminalKind,
      scorePermille: puzzleScorePermille(
        args.wrongMove
          ? 0.5
          : deriveOutcomeScore([
              ...sliceCurrentPlay(args.interactions, args.puzzleId),
              terminal,
            ])
      ),
    });
  }
}
