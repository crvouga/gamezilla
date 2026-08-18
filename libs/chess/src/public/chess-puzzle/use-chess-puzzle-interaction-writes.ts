import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useMyId } from '@libs/auth/public/use-current-user';
import { useClock } from '@pkgs/clock';
import { useCreateId } from '@pkgs/uuid';
import { useCallback, useMemo } from 'react';

import type {
  ChessPuzzleInteractionKind,
  ChessPuzzleInteractionRow,
} from '../chess-puzzle-interaction-entities';
import { ChessPuzzleInteractionDb } from './chess-puzzle-interaction-db';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

type AppendExtra = {
  uci?: string | null;
  correct?: boolean | null;
  solveIdx?: number;
};

export function useChessPuzzleInteractionWrites(args: {
  puzzleId: string;
  puzzleRating: number;
  solveIdx: number;
  interactions: readonly ChessPuzzleInteractionRow[];
}): {
  appendInteraction: (
    kind: ChessPuzzleInteractionKind,
    extra?: AppendExtra
  ) => Promise<void>;
  finalizePlay: (terminalKind: 'solved' | 'abandoned') => Promise<void>;
} {
  const { puzzleId, puzzleRating, solveIdx, interactions } = args;
  const myId = useMyId();
  const mutationClient = useMutationClient();
  const createId = useCreateId();
  const clock = useClock();
  const { profileRating, profileRd } = useChessPuzzleProfileRatings(myId);
  const interactionDb = useMemo(
    () => new ChessPuzzleInteractionDb(mutationClient, createId),
    [mutationClient, createId]
  );

  const appendInteraction = useCallback(
    async (kind: ChessPuzzleInteractionKind, extra?: AppendExtra) => {
      if (myId.length === 0) return;
      await interactionDb.appendRow({
        ownerId: myId,
        puzzleId,
        puzzleRating,
        kind,
        solveIdx: extra?.solveIdx ?? solveIdx,
        uci: extra?.uci ?? null,
        correct: extra?.correct ?? null,
      });
    },
    [interactionDb, myId, puzzleId, puzzleRating, solveIdx]
  );

  const finalizePlay = useCallback(
    async (terminalKind: 'solved' | 'abandoned') => {
      if (myId.length === 0) return;
      await interactionDb.finalizePlayWithProfile({
        ownerId: myId,
        puzzleId,
        puzzleRating,
        solveIdx,
        interactions,
        terminalKind,
        profileRating,
        profileRd,
        clock,
      });
    },
    [
      interactionDb,
      interactions,
      myId,
      profileRating,
      profileRd,
      puzzleId,
      puzzleRating,
      solveIdx,
      clock,
    ]
  );

  return { appendInteraction, finalizePlay };
}
