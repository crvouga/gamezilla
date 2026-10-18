import { useMyId } from '@libs/auth-client/use-current-user';
import type {
  PuzzleInteractionKind,
  PuzzleOutcomeKind,
} from '@libs/game-puzzle-shared/interaction-entities';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useCreateId } from '@pkgs/uuid-client/solid';
import type { Accessor } from 'solid-js';
import { ChessPuzzleInteractionDb } from './chess-puzzle-interaction-db';

type AppendExtra = {
  uci?: string | null;
  correct?: boolean | null;
  solveIdx?: number;
};

export function useChessPuzzleInteractionWrites(args: {
  puzzleId: Accessor<string>;
  puzzleRating: Accessor<number>;
  puzzleRatingDeviation: Accessor<number>;
  solveIdx: Accessor<number>;
  attemptKey: Accessor<string | null>;
}): {
  appendInteraction: (
    kind: PuzzleInteractionKind,
    extra?: AppendExtra
  ) => Promise<void>;
  finalizePlay: (
    terminalKind: PuzzleOutcomeKind,
    scorePermille: 0 | 500 | 1000
  ) => Promise<void>;
} {
  const myId = useMyId();
  const mutationClient = useMutationClient();
  const createId = useCreateId();
  const interactionDb = new ChessPuzzleInteractionDb(mutationClient, createId);

  const appendInteraction = async (
    kind: PuzzleInteractionKind,
    extra?: AppendExtra
  ): Promise<void> => {
    if (myId().length === 0) return;
    await interactionDb.appendRow({
      ownerId: myId(),
      puzzleId: args.puzzleId(),
      puzzleRating: args.puzzleRating(),
      kind,
      solveIdx: extra?.solveIdx ?? args.solveIdx(),
      uci: extra?.uci ?? null,
      correct: extra?.correct ?? null,
    });
  };

  const finalizePlay = async (
    terminalKind: PuzzleOutcomeKind,
    scorePermille: 0 | 500 | 1000
  ): Promise<void> => {
    if (myId().length === 0) return;
    const attemptKey = args.attemptKey();
    if (attemptKey === null) return;
    await interactionDb.finalizeRatedAttempt({
      attemptKey,
      ownerId: myId(),
      puzzleId: args.puzzleId(),
      puzzleRating: args.puzzleRating(),
      puzzleRatingDeviation: args.puzzleRatingDeviation(),
      solveIdx: args.solveIdx(),
      terminalKind,
      scorePermille,
    });
  };

  return { appendInteraction, finalizePlay };
}
