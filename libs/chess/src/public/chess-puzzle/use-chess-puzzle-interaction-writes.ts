import { useMyId } from '@libs/auth/public/use-current-user';
import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { useClock } from '@pkgs/clock/solid';
import { useCreateId } from '@pkgs/uuid/solid';
import type { Accessor } from 'solid-js';

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
  puzzleId: Accessor<string>;
  puzzleRating: Accessor<number>;
  solveIdx: Accessor<number>;
  interactions: Accessor<readonly ChessPuzzleInteractionRow[]>;
}): {
  appendInteraction: (
    kind: ChessPuzzleInteractionKind,
    extra?: AppendExtra
  ) => Promise<void>;
  finalizePlay: (terminalKind: 'solved' | 'abandoned') => Promise<void>;
} {
  const myId = useMyId();
  const mutationClient = useMutationClient();
  const createId = useCreateId();
  const clock = useClock();
  const profile = useChessPuzzleProfileRatings(myId);
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
    terminalKind: 'solved' | 'abandoned'
  ): Promise<void> => {
    if (myId().length === 0) return;
    await interactionDb.finalizePlayWithProfile({
      ownerId: myId(),
      puzzleId: args.puzzleId(),
      puzzleRating: args.puzzleRating(),
      solveIdx: args.solveIdx(),
      interactions: args.interactions(),
      terminalKind,
      profileRating: profile.profileRating,
      profileRd: profile.profileRd,
      clock,
    });
  };

  return { appendInteraction, finalizePlay };
}
