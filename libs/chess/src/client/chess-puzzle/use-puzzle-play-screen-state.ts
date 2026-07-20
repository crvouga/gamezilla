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
import { ChessPuzzlePlayAttr } from '../../shared/chess-puzzle-play';
import type { ChessPuzzleE2ELoadingStatusProps } from './chess-puzzle-e2e-loading-status';
import { useNextPuzzleId } from './use-next-puzzle-id';

export type PuzzlePlayScreenModel = {
  backToChessRoot: () => void;
  activePuzzleId: string | null;
  attemptSeed: number;
  readyGeneration: number;
  onRequestNext: () => void;
  e2eLoadingStatus: ChessPuzzleE2ELoadingStatusProps;
};

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

  /** Last attemptSeed value we've already swapped `activePuzzleId` for. */
  const placedAttemptRef = useRef(0);

  const commitAttempt = useCallback((seed: number): void => {
    placedAttemptRef.current = seed;
    setReadyGeneration(seed);
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

  // Atomic puzzle-id swap: never null `activePuzzleId` between puzzles,
  // so `PuzzlePlayer` stays mounted across the entire session.
  //
  //   1. First mount with no candidate yet (`activePuzzleId === null`):
  //      resume the room session if there is one, else wait for `nextId`
  //      and adopt it as soon as it's available.
  //   2. Mid-session "Next" press (`attemptSeed > placedAttemptRef`):
  //      wait for `ClearChessPuzzlePlay` to land (`roomPuzzleId === null`)
  //      and for the candidate query to produce a fresh `nextId`, then
  //      swap `activePuzzleId` in a single state update. The old id is
  //      replaced directly, never via an intermediate `null`.
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c605ca'},body:JSON.stringify({sessionId:'c605ca',hypothesisId:'H-A',location:'use-puzzle-play-screen-state.ts:swap-effect',message:'puzzle swap effect',data:{activePuzzleId,attemptSeed,placedAttempt:placedAttemptRef.current,roomPuzzleId,nextId,nextLoading,bandedCount,fallbackCount,replayCount,myId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (activePuzzleId === null) {
      if (attemptSeed === 0 && roomPuzzleId !== null) {
        setActivePuzzleId(roomPuzzleId);
        commitAttempt(attemptSeed);
        return;
      }
      if (nextId !== null) {
        setActivePuzzleId(nextId);
        commitAttempt(attemptSeed);
      }
      return;
    }
    if (attemptSeed === placedAttemptRef.current) return;
    if (roomPuzzleId !== null) return;
    if (nextId === null) return;
    if (nextId !== activePuzzleId) {
      setActivePuzzleId(nextId);
    }
    // The candidate is ready, so the generation bump can safely re-dispatch
    // Start once the room is idle.
    commitAttempt(attemptSeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- agent log reads extra debug values
  }, [activePuzzleId, attemptSeed, commitAttempt, nextId, roomPuzzleId]);

  const onRequestNext = useCallback(() => {
    setAttemptSeed((s) => s + 1);
  }, []);

  return {
    backToChessRoot,
    activePuzzleId,
    attemptSeed,
    readyGeneration,
    onRequestNext,
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
