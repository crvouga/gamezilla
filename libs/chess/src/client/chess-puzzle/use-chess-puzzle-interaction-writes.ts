import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { useMyId } from '@libs/auth/client/use-current-user';
import { useClock } from '@pkgs/clock';
import { useCreateId } from '@pkgs/uuid';
import { useCallback } from 'react';

import type {
  ChessPuzzleInteractionKind,
  ChessPuzzleInteractionRow,
} from '../../shared/chess-puzzle-interaction-entities';
import {
  appendPuzzleInteractionRow,
  finalizePuzzlePlayWithProfile,
} from './chess-puzzle-interaction-db';
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

  const appendInteraction = useCallback(
    async (kind: ChessPuzzleInteractionKind, extra?: AppendExtra) => {
      if (myId.length === 0) return;
      await appendPuzzleInteractionRow(
        mutationClient,
        {
          ownerId: myId,
          puzzleId,
          puzzleRating,
          kind,
          solveIdx: extra?.solveIdx ?? solveIdx,
          uci: extra?.uci ?? null,
          correct: extra?.correct ?? null,
        },
        createId
      );
    },
    [mutationClient, myId, puzzleId, puzzleRating, solveIdx, createId]
  );

  const finalizePlay = useCallback(
    async (terminalKind: 'solved' | 'abandoned') => {
      if (myId.length === 0) return;
      await finalizePuzzlePlayWithProfile(mutationClient, {
        ownerId: myId,
        puzzleId,
        puzzleRating,
        solveIdx,
        interactions,
        terminalKind,
        profileRating,
        profileRd,
        createId,
        clock,
      });
    },
    [
      interactions,
      mutationClient,
      myId,
      profileRating,
      profileRd,
      puzzleId,
      puzzleRating,
      solveIdx,
      createId,
      clock,
    ]
  );

  return { appendInteraction, finalizePlay };
}
