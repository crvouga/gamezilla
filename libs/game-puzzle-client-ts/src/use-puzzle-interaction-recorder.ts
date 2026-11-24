import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { hasPendingPlay } from '@libs/game-puzzle-shared-ts/derive';
import type { PuzzleInteractionRow } from '@libs/game-puzzle-shared-ts/interaction-entities';
import { PUZZLE_INTERACTION_KIND } from '@libs/game-puzzle-shared-ts/interaction-entities';
import { syncInteractionForRoomStatus } from '@libs/game-puzzle-shared-ts/interaction-status-sync';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared-ts/play-attr';
import { useLogger } from '@pkgs/logger-client-ts/solid';
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
  const r = args.recorder;
  createEffect(
    () => {
      const key = args.attemptKey();
      if (key === null || !r.canRecord() || args.myId().length === 0)
        return null;
      if (!r.interactionsReady() || r.status() === 'loading') return null;
      return { key, solving: r.status() === PUZZLE_PLAY_STATUS.solving };
    },
    (attempt) => {
      if (attempt === null || handledRef.current === attempt.key) return;
      handledRef.current = attempt.key;
      if (!attempt.solving) return;
      untrack(() => {
        if (!hasPendingPlay(r.interactions(), r.puzzleId())) args.append();
      });
    }
  );
}

/**
 * Mirrors the solver's moves: each room status transition is compared with
 * what was seen before it on this puzzle, and with the last action pressed.
 */
function useRecordMoves(args: {
  recorder: InteractionRecorderArgs;
  myId: Accessor<string>;
  append: Parameters<
    typeof syncInteractionForRoomStatus
  >[0]['appendInteraction'];
}): (uci: string) => void {
  const r = args.recorder;
  const prevStatusRef: Ref<PuzzlePlayStatus | 'loading' | null> = {
    current: null,
  };
  const prevSolveIdxRef: Ref<number | null> = { current: null };
  const lastUciRef: Ref<string | null> = { current: null };
  type Seen = {
    readonly puzzleId: string;
    readonly status: PuzzlePlayStatus | 'loading';
    readonly canRecord: boolean;
    readonly myId: string;
    readonly solveIdx: number;
  };
  const syncStatus = (now: Seen): void => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = now.status;
    if (now.canRecord)
      syncInteractionForRoomStatus({
        prev,
        status: now.status,
        myId: now.myId,
        solveIdx: now.solveIdx,
        prevSolveIdx: prevSolveIdxRef.current,
        lastUci: lastUciRef.current,
        appendInteraction: args.append,
      });
    lastUciRef.current = null;
  };
  // One effect, so its steps keep their order: another puzzle forgets what
  // was seen, then the transition is mirrored against what was seen before
  // it, then the step it was compared with moves on.
  createEffect(
    (): Seen => ({
      puzzleId: r.puzzleId(),
      status: r.status(),
      canRecord: r.canRecord(),
      myId: args.myId(),
      solveIdx: r.solveIdx(),
    }),
    (now, before) => {
      if (before?.puzzleId !== now.puzzleId) {
        prevStatusRef.current = null;
        prevSolveIdxRef.current = null;
        lastUciRef.current = null;
      }
      const moved =
        before === undefined ||
        before.status !== now.status ||
        before.canRecord !== now.canRecord ||
        before.myId !== now.myId ||
        before.solveIdx !== now.solveIdx;
      if (moved) untrack(() => syncStatus(now));
      if (before?.solveIdx !== now.solveIdx)
        prevSolveIdxRef.current = now.solveIdx;
    }
  );

  return (uci) => {
    lastUciRef.current = uci;
  };
}

/**
 * Mirrors room status transitions into this actor's append-only interaction
 * log. Writes are local-first mutations; a rejected write is logged with the
 * puzzle id so the rating gap is diagnosable instead of a silent no-op. The
 * rated outcome is written at most once per attempt (§5).
 */
export function usePuzzleInteractionRecorder(args: InteractionRecorderArgs): {
  appendUsedHint: () => Promise<void>;
  setLastAction: (uci: string) => void;
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

  const attemptKey = (): string | null => {
    return args.attemptKey();
  };

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

  const setLastAction = useRecordMoves({
    recorder: args,
    myId,
    append: (kind, extra) => {
      appendInteraction(kind, extra).catch(reportWriteFailure(kind));
    },
  });

  const appendUsedHint = async (): Promise<void> => {
    if (!args.canRecord()) return;
    await appendInteraction(PUZZLE_INTERACTION_KIND.usedHint).catch(
      reportWriteFailure(PUZZLE_INTERACTION_KIND.usedHint)
    );
  };

  return { appendUsedHint, setLastAction };
}
