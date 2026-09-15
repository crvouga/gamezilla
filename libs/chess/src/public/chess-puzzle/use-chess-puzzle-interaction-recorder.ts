import { useMyId } from '@libs/auth/public/use-current-user';
import { useLogger } from '@pkgs/logger/solid';
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
  /**
   * Only the member driving the shared board owns the attempt. Spectators in
   * the same space watch the room status change but must not be rated for it.
   */
  canRecord: Accessor<boolean>;
};

/**
 * Mirrors room status transitions into this actor's append-only interaction
 * log. Writes are local-first mutations; a rejected write is logged with the
 * puzzle id so the rating gap is diagnosable instead of a silent no-op.
 */
export function useChessPuzzleInteractionRecorder(
  args: InteractionRecorderArgs
): {
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  setLastUci: (uci: string) => void;
} {
  const myId = useMyId();
  const log = useLogger('chess-puzzle-recorder');
  const { appendInteraction, finalizePlay } = useChessPuzzleInteractionWrites({
    puzzleId: args.puzzleId,
    puzzleRating: args.puzzleRating,
    solveIdx: args.solveIdx,
    interactions: args.interactions,
    allInteractions: args.allInteractions,
  });

  const reportWriteFailure = (what: string) => (error: unknown) => {
    log.error(`puzzle interaction write failed: ${what}`, {
      puzzleId: args.puzzleId(),
      error,
    });
  };

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
    if (!args.canRecord()) {
      lastUciRef.current = null;
      return;
    }
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
        appendInteraction(kind, extra).catch(reportWriteFailure(kind));
      },
      finalizePlay: (k) => {
        finalizePlay(k).catch(reportWriteFailure(k));
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
    if (!args.canRecord()) return;
    await appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.usedHint).catch(
      reportWriteFailure(CHESS_PUZZLE_INTERACTION_KIND.usedHint)
    );
  };

  const appendAbandoned = async (): Promise<void> => {
    if (!args.canRecord()) return;
    await finalizePlay('abandoned').catch(reportWriteFailure('abandoned'));
  };

  return { appendUsedHint, appendAbandoned, setLastUci };
}
