import { useMyId } from '@libs/auth/client/use-current-user';
import { useCallback, useEffect, useRef } from 'react';

import { sliceCurrentPlay } from '../../shared/chess-puzzle-derive';
import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionRow,
} from '../../shared/chess-puzzle-interaction-entities';
import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import { syncInteractionForRoomStatus } from './chess-puzzle-interaction-status-sync';
import { useChessPuzzleInteractionWrites } from './use-chess-puzzle-interaction-writes';

export type InteractionRecorderArgs = {
  puzzleId: string;
  puzzleRating: number;
  status: ChessPuzzlePlayStatus | 'loading';
  solveIdx: number;
  interactions: readonly ChessPuzzleInteractionRow[];
};

/**
 * Appends interaction rows on room transitions; updates profile on terminal events.
 */
export function useChessPuzzleInteractionRecorder(
  args: InteractionRecorderArgs
): {
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  setLastUci: (uci: string) => void;
} {
  const { puzzleId, puzzleRating, status, solveIdx, interactions } = args;
  const myId = useMyId();
  const { appendInteraction, finalizePlay } = useChessPuzzleInteractionWrites({
    puzzleId,
    puzzleRating,
    solveIdx,
    interactions,
  });

  const prevStatusRef = useRef<ChessPuzzlePlayStatus | 'loading' | null>(null);
  const prevSolveIdxRef = useRef<number | null>(null);
  const lastUciRef = useRef<string | null>(null);

  useEffect(() => {
    prevStatusRef.current = null;
    prevSolveIdxRef.current = null;
    lastUciRef.current = null;
  }, [puzzleId]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    const play = sliceCurrentPlay(interactions, puzzleId);
    const playAlreadySolved = play.some(
      (r) => r.kind === CHESS_PUZZLE_INTERACTION_KIND.solved
    );
    syncInteractionForRoomStatus({
      prev,
      status,
      myId,
      solveIdx,
      prevSolveIdx: prevSolveIdxRef.current,
      lastUci: lastUciRef.current,
      playAlreadySolved,
      appendInteraction: (kind, extra) => {
        void appendInteraction(kind, extra);
      },
      finalizePlay: (k) => {
        void finalizePlay(k);
      },
    });
    lastUciRef.current = null;
  }, [
    appendInteraction,
    finalizePlay,
    interactions,
    myId,
    puzzleId,
    solveIdx,
    status,
  ]);

  useEffect(() => {
    prevSolveIdxRef.current = solveIdx;
  }, [solveIdx]);

  const setLastUci = useCallback((uci: string) => {
    lastUciRef.current = uci;
  }, []);

  const appendUsedHint = useCallback(async () => {
    await appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.usedHint);
  }, [appendInteraction]);

  const appendAbandoned = useCallback(async () => {
    await finalizePlay('abandoned');
  }, [finalizePlay]);

  return { appendUsedHint, appendAbandoned, setLastUci };
}
