import { useMyId } from '@libs/auth-client/use-current-user';
import { hasPendingPlay } from '@libs/game-puzzle-shared/derive';
import type { PuzzleInteractionRow } from '@libs/game-puzzle-shared/interaction-entities';
import { PUZZLE_INTERACTION_KIND } from '@libs/game-puzzle-shared/interaction-entities';
import { syncInteractionForRoomStatus } from '@libs/game-puzzle-shared/interaction-status-sync';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared/play-attr';
import { useLogger } from '@pkgs/logger-client/solid';
import { type Accessor, createEffect, untrack } from 'solid-js';
import { usePuzzleInteractionWrites } from './use-puzzle-interaction-writes';

export type InteractionRecorderArgs = {
  puzzleId: Accessor<string>;
  puzzleRating: Accessor<number>;
  puzzleRatingDeviation: Accessor<number>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
  solveIdx: Accessor<number>;
  interactions: Accessor<readonly PuzzleInteractionRow[]>;
  /** The per-puzzle interaction read has landed (restore decisions wait for it). */
  interactionsReady: Accessor<boolean>;
  /**
   * Only the member driving the shared board owns the attempt. Spectators in
   * the same space watch the room status change but must not be rated for it.
   */
  canRecord: Accessor<boolean>;
  attemptKey: Accessor<string | null>;
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
    if (r.status() !== PUZZLE_PLAY_STATUS.solving) return;
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
export function usePuzzleInteractionRecorder(args: InteractionRecorderArgs): {
  appendUsedHint: () => Promise<void>;
  setLastUci: (uci: string) => void;
} {
  const myId = useMyId();
  const log = useLogger('chess-puzzle-recorder');
  const { appendInteraction } = usePuzzleInteractionWrites({
    puzzleId: args.puzzleId,
    puzzleRating: args.puzzleRating,
    puzzleRatingDeviation: args.puzzleRatingDeviation,
    solveIdx: args.solveIdx,
    attemptKey: args.attemptKey,
  });

  const reportWriteFailure = (what: string) => (error: unknown) => {
    log.error(`puzzle interaction write failed: ${what}`, {
      puzzleId: args.puzzleId(),
      error,
    });
  };

  const prevStatusRef: Ref<PuzzlePlayStatus | 'loading' | null> = {
    current: null,
  };
  const prevSolveIdxRef: Ref<number | null> = { current: null };
  const lastUciRef: Ref<string | null> = { current: null };
  const attemptKey = (): string | null => {
    return args.attemptKey();
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
      appendInteraction(PUZZLE_INTERACTION_KIND.started).catch(
        reportWriteFailure(PUZZLE_INTERACTION_KIND.started)
      );
    },
  });

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
    await appendInteraction(PUZZLE_INTERACTION_KIND.usedHint).catch(
      reportWriteFailure(PUZZLE_INTERACTION_KIND.usedHint)
    );
  };

  return { appendUsedHint, setLastUci };
}
