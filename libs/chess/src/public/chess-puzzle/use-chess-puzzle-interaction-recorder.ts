import { useMyId } from '@libs/auth/public/use-current-user';
import { type Accessor, createEffect } from 'solid-js';

import { sliceCurrentPlay } from '../chess-puzzle-derive';
import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionRow,
} from '../chess-puzzle-interaction-entities';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';
import { syncInteractionForRoomStatus } from './chess-puzzle-interaction-status-sync';
import { useChessPuzzleInteractionWrites } from './use-chess-puzzle-interaction-writes';

export type InteractionRecorderArgs = {
  puzzleId: Accessor<string>;
  puzzleRating: Accessor<number>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  solveIdx: Accessor<number>;
  interactions: Accessor<readonly ChessPuzzleInteractionRow[]>;
  allInteractions: Accessor<readonly ChessPuzzleInteractionRow[]>;
};

export function useChessPuzzleInteractionRecorder(
  args: InteractionRecorderArgs
): {
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  setLastUci: (uci: string) => void;
} {
  const myId = useMyId();
  const { appendInteraction, finalizePlay } = useChessPuzzleInteractionWrites({
    puzzleId: args.puzzleId,
    puzzleRating: args.puzzleRating,
    solveIdx: args.solveIdx,
    interactions: args.interactions,
    allInteractions: args.allInteractions,
  });

  const prevStatusRef: {
    current: ChessPuzzlePlayStatus | 'loading' | null;
  } = { current: null };
  const prevSolveIdxRef: { current: number | null } = { current: null };
  const lastUciRef: { current: string | null } = { current: null };

  createEffect(() => {
    void args.puzzleId();
    prevStatusRef.current = null;
    prevSolveIdxRef.current = null;
    lastUciRef.current = null;
  });

  createEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = args.status();
    const play = sliceCurrentPlay(args.interactions(), args.puzzleId());
    const playAlreadySolved = play.some(
      (r) => r.kind === CHESS_PUZZLE_INTERACTION_KIND.solved
    );
    syncInteractionForRoomStatus({
      prev,
      status: args.status(),
      myId: myId(),
      solveIdx: args.solveIdx(),
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
  });

  createEffect(() => {
    prevSolveIdxRef.current = args.solveIdx();
  });

  const setLastUci = (uci: string): void => {
    lastUciRef.current = uci;
  };

  const appendUsedHint = async (): Promise<void> => {
    await appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.usedHint);
  };

  const appendAbandoned = async (): Promise<void> => {
    await finalizePlay('abandoned');
  };

  return { appendUsedHint, appendAbandoned, setLastUci };
}
