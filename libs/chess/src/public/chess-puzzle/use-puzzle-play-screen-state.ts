import { useMyId } from '@libs/auth/client/use-current-user';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/client/room/use-space-room-selector';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../../shared/chess-main-menu';
import {
  ChessPuzzlePlayAttr,
  ClearChessPuzzlePlay,
} from '../../shared/chess-puzzle-play';
import type { ChessPuzzleE2ELoadingStatusProps } from './chess-puzzle-e2e-loading-status';
import { useNextPuzzleId } from './use-next-puzzle-id';

export type PuzzlePlayScreenModel = {
  backToChessRoot: () => void;
  activePuzzleId: string | null;
  attemptSeed: number;
  readyGeneration: number;
  /** Bumps only when the screen intentionally places a puzzle to Start. */
  startNonce: number;
  onRequestNext: () => void;
  /**
   * Feed settings Done with a real config change: Clear room play then bump
   * seed so placement re-picks from the updated candidate pool (same path as
   * Next, without abandon recording).
   */
  reselectActivePuzzleFromFeed: () => void;
  e2eLoadingStatus: ChessPuzzleE2ELoadingStatusProps;
};

type CommitAttempt = (seed: number, armStart: boolean) => void;

type PuzzlePlacementArgs = {
  activePuzzleId: string | null;
  attemptSeed: number;
  commitAttempt: CommitAttempt;
  nextId: string | null;
  roomPuzzleId: string | null;
  placedAttemptRef: { current: number };
  setActivePuzzleId: (id: string) => void;
};

/**
 * Atomic puzzle-id swap: never null `activePuzzleId` between puzzles,
 * so `PuzzlePlayer` stays mounted across the entire session.
 *
 * Start is armed only via `startNonce` (not merely idle room status) so a
 * remote/local Clear cannot re-Start the previous puzzle on every client.
 *
 * Room puzzle id is authoritative whenever it diverges from local
 * `activePuzzleId` — otherwise the board FEN (from room) updates while
 * status projection stays `'loading'` (puzzleIdMismatch).
 */
function applyPuzzlePlacement(args: PuzzlePlacementArgs): void {
  const {
    activePuzzleId,
    attemptSeed,
    commitAttempt,
    nextId,
    roomPuzzleId,
    placedAttemptRef,
    setActivePuzzleId,
  } = args;

  if (activePuzzleId === null) {
    placeWhenNoActivePuzzle(args);
    return;
  }
  if (roomPuzzleId !== null && roomPuzzleId !== activePuzzleId) {
    setActivePuzzleId(roomPuzzleId);
    commitAttempt(attemptSeed, false);
    return;
  }
  if (attemptSeed === placedAttemptRef.current) return;
  if (roomPuzzleId !== null) {
    commitAttempt(attemptSeed, false);
    return;
  }
  if (nextId === null || nextId === activePuzzleId) return;
  setActivePuzzleId(nextId);
  commitAttempt(attemptSeed, true);
}

function placeWhenNoActivePuzzle(args: PuzzlePlacementArgs): void {
  const {
    attemptSeed,
    commitAttempt,
    nextId,
    roomPuzzleId,
    setActivePuzzleId,
  } = args;
  if (attemptSeed === 0 && roomPuzzleId !== null) {
    setActivePuzzleId(roomPuzzleId);
    commitAttempt(attemptSeed, false);
    return;
  }
  if (nextId !== null) {
    setActivePuzzleId(nextId);
    commitAttempt(attemptSeed, true);
  }
}

export function usePuzzlePlayScreenState(): PuzzlePlayScreenModel {
  const myId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
  const backToChessRoot = useCallback(() => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  }, [dispatch]);

  const [activePuzzleId, setActivePuzzleId] = useState<string | null>(null);
  const [attemptSeed, setAttemptSeed] = useState(0);
  /** Player may Start only after the screen commits puzzle placement for this seed. */
  const [readyGeneration, setReadyGeneration] = useState(0);
  const [startNonce, setStartNonce] = useState(0);

  /** Last attemptSeed value we've already swapped `activePuzzleId` for. */
  const placedAttemptRef = useRef(0);

  const commitAttempt = useCallback((seed: number, armStart: boolean): void => {
    placedAttemptRef.current = seed;
    setReadyGeneration(seed);
    if (armStart) {
      setStartNonce((n) => n + 1);
    }
  }, []);

  const {
    puzzleId: nextId,
    loading: nextLoading,
    bandedCount,
    fallbackCount,
    replayCount,
  } = useNextPuzzleId({
    currentPuzzleId: activePuzzleId ?? roomPuzzleId,
    seed: `${myId}-${attemptSeed}`,
  });

  useEffect(() => {
    applyPuzzlePlacement({
      activePuzzleId,
      attemptSeed,
      commitAttempt,
      nextId,
      roomPuzzleId,
      placedAttemptRef,
      setActivePuzzleId,
    });
  }, [activePuzzleId, attemptSeed, commitAttempt, nextId, roomPuzzleId]);

  const onRequestNext = useCallback(() => {
    setAttemptSeed((s) => s + 1);
  }, []);

  const reselectActivePuzzleFromFeed = useCallback(() => {
    dispatch(ClearChessPuzzlePlay({}));
    onRequestNext();
  }, [dispatch, onRequestNext]);

  return {
    backToChessRoot,
    activePuzzleId,
    attemptSeed,
    readyGeneration,
    startNonce,
    onRequestNext,
    reselectActivePuzzleFromFeed,
    e2eLoadingStatus: {
      myId,
      nextId,
      activePuzzleId,
      bandedCount,
      fallbackCount,
      replayCount,
      loading: nextLoading,
    },
  };
}
