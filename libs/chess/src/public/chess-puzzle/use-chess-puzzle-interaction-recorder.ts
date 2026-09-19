import { useMyId } from '@libs/auth/public/use-current-user';
import { useLogger } from '@pkgs/logger/solid';
import { type Accessor, createEffect, untrack } from 'solid-js';

import { hasPendingPlay, hasPlayOutcome } from '../chess-puzzle-derive';
import {
  CHESS_PUZZLE_INTERACTION_KIND,
  type ChessPuzzleInteractionRow,
  type ChessPuzzleOutcomeKind,
} from '../chess-puzzle-interaction-entities';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess-puzzle-play';
import { syncInteractionForRoomStatus } from './chess-puzzle-interaction-status-sync';
import { useChessPuzzleInteractionWrites } from './use-chess-puzzle-interaction-writes';

export type InteractionRecorderArgs = {
  puzzleId: Accessor<string>;
  puzzleRating: Accessor<number>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  solveIdx: Accessor<number>;
  interactions: Accessor<readonly ChessPuzzleInteractionRow[]>;
  /** The per-puzzle interaction read has landed (restore decisions wait for it). */
  interactionsReady: Accessor<boolean>;
  allInteractions: Accessor<readonly ChessPuzzleInteractionRow[]>;
  /** Room commit time of the attempt's Start — the attempt's identity. */
  attemptStartedAtMs: Accessor<number | null>;
  /**
   * Only the member driving the shared board owns the attempt. Spectators in
   * the same space watch the room status change but must not be rated for it.
   */
  canRecord: Accessor<boolean>;
};

type Ref<T> = { current: T };

/**
 * Writes `started` once per room attempt — unless this puzzle already has a
 * pending play (a reload / return restores it: no second start, §5).
 */
function useRecordStarted(args: {
  recorder: InteractionRecorderArgs;
  myId: Accessor<string>;
  attemptKey: Accessor<string | null>;
  append: () => void;
}): void {
  const handledRef: Ref<string | null> = { current: null };
  createEffect(() => {
    const r = args.recorder;
    const key = args.attemptKey();
    if (key === null || !r.canRecord() || args.myId().length === 0) return;
    if (!r.interactionsReady() || r.status() === 'loading') return;
    if (handledRef.current === key) return;
    handledRef.current = key;
    if (r.status() !== CHESS_PUZZLE_PLAY_STATUS.solving) return;
    if (hasPendingPlay(untrack(r.interactions), untrack(r.puzzleId))) return;
    args.append();
  });
}

/**
 * Mirrors room status transitions into this actor's append-only interaction
 * log. Writes are local-first mutations; a rejected write is logged with the
 * puzzle id so the rating gap is diagnosable instead of a silent no-op. The
 * rated outcome is written at most once per attempt (§5).
 */
export function useChessPuzzleInteractionRecorder(
  args: InteractionRecorderArgs
): {
  appendUsedHint: () => Promise<void>;
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

  const prevStatusRef: Ref<ChessPuzzlePlayStatus | 'loading' | null> = {
    current: null,
  };
  const prevSolveIdxRef: Ref<number | null> = { current: null };
  const lastUciRef: Ref<string | null> = { current: null };
  const outcomeForRef: Ref<string | null> = { current: null };
  const attemptKey = (): string | null => {
    const startedAt = args.attemptStartedAtMs();
    return startedAt === null ? null : `${args.puzzleId()}|${startedAt}`;
  };

  createEffect(() => {
    void args.puzzleId();
    prevStatusRef.current = null;
    prevSolveIdxRef.current = null;
    lastUciRef.current = null;
  });

  useRecordStarted({
    recorder: args,
    myId,
    attemptKey,
    append: () => {
      appendInteraction(CHESS_PUZZLE_INTERACTION_KIND.started).catch(
        reportWriteFailure(CHESS_PUZZLE_INTERACTION_KIND.started)
      );
    },
  });

  const recordOutcome = (kind: ChessPuzzleOutcomeKind): void => {
    const key = attemptKey();
    if (key === null || outcomeForRef.current === key) return;
    outcomeForRef.current = key;
    if (hasPlayOutcome(untrack(args.interactions), untrack(args.puzzleId))) {
      return;
    }
    finalizePlay(kind).catch(reportWriteFailure(kind));
  };

  createEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = args.status();
    if (!args.canRecord()) {
      lastUciRef.current = null;
      return;
    }
    syncInteractionForRoomStatus({
      prev,
      status: args.status(),
      myId: myId(),
      solveIdx: args.solveIdx(),
      prevSolveIdx: prevSolveIdxRef.current,
      lastUci: lastUciRef.current,
      appendInteraction: (kind, extra) => {
        appendInteraction(kind, extra).catch(reportWriteFailure(kind));
      },
      recordOutcome,
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

  return { appendUsedHint, setLastUci };
}
