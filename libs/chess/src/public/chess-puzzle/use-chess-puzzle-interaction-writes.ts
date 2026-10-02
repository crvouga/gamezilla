import { useMyId } from '@libs/auth/public/use-current-user';
import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { useCreateId } from '@pkgs/uuid/solid';
import type { Accessor } from 'solid-js';

import type {
  ChessPuzzleInteractionKind,
  ChessPuzzleOutcomeKind,
} from '../chess-puzzle-interaction-entities';
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
    kind: ChessPuzzleInteractionKind,
    extra?: AppendExtra
  ) => Promise<void>;
  finalizePlay: (
    terminalKind: ChessPuzzleOutcomeKind,
    scorePermille: 0 | 500 | 1000
  ) => Promise<void>;
} {
  const myId = useMyId();
  const mutationClient = useMutationClient();
  const createId = useCreateId();
  const interactionDb = new ChessPuzzleInteractionDb(mutationClient, createId);

  const appendInteraction = async (
    kind: ChessPuzzleInteractionKind,
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
    terminalKind: ChessPuzzleOutcomeKind,
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
