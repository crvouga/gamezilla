import { useMyId } from '@libs/auth/client/use-current-user';
import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
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
  const engine = useSyncEngine();
  const myId = useMyId();
  const writeContext = useWriteContext();
  const { profileRating, profileRd } = useChessPuzzleProfileRatings(myId);

  const appendInteraction = useCallback(
    async (kind: ChessPuzzleInteractionKind, extra?: AppendExtra) => {
      if (myId.length === 0) return;
      await appendPuzzleInteractionRow(engine.db, writeContext, {
        ownerId: myId,
        puzzleId,
        puzzleRating,
        kind,
        solveIdx: extra?.solveIdx ?? solveIdx,
        uci: extra?.uci ?? null,
        correct: extra?.correct ?? null,
      });
    },
    [engine, myId, puzzleId, puzzleRating, solveIdx, writeContext]
  );

  const finalizePlay = useCallback(
    async (terminalKind: 'solved' | 'abandoned') => {
      if (myId.length === 0) return;
      await finalizePuzzlePlayWithProfile(engine.db, writeContext, {
        ownerId: myId,
        puzzleId,
        puzzleRating,
        solveIdx,
        interactions,
        terminalKind,
        profileRating,
        profileRd,
      });
    },
    [
      engine,
      interactions,
      myId,
      profileRating,
      profileRd,
      puzzleId,
      puzzleRating,
      solveIdx,
      writeContext,
    ]
  );

  return { appendInteraction, finalizePlay };
}
