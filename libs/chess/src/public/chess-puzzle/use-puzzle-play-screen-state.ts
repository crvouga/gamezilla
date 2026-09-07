import { useMyId } from '@libs/auth/public/use-current-user';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';

import { CHESS_SCREEN, SetChessMainMenuScreen } from '../chess-main-menu';
import {
  ChessPuzzlePlayAttr,
  ClearChessPuzzlePlay,
} from '../chess-puzzle-play';
import type { ChessPuzzleE2ELoadingStatusProps } from './chess-puzzle-e2e-loading-status';
import { useNextPuzzleId } from './use-next-puzzle-id';

export type PuzzlePlayScreenModel = {
  backToChessRoot: () => void;
  activePuzzleId: Accessor<string | null>;
  attemptSeed: Accessor<number>;
  readyGeneration: Accessor<number>;
  startNonce: Accessor<number>;
  onRequestNext: () => void;
  reselectActivePuzzleFromFeed: () => void;
  e2eLoadingStatus: Accessor<ChessPuzzleE2ELoadingStatusProps>;
};

export function usePuzzlePlayScreenState(): PuzzlePlayScreenModel {
  const myId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
  const backToChessRoot = (): void => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  };

  const [activePuzzleId, setActivePuzzleId] = createSignal<string | null>(null);
  const [attemptSeed, setAttemptSeed] = createSignal(0);
  const [readyGeneration, setReadyGeneration] = createSignal(0);
  const [startNonce, setStartNonce] = createSignal(0);

  const placedAttemptRef: { current: number } = { current: 0 };

  const commitAttempt = (seed: number, armStart: boolean): void => {
    placedAttemptRef.current = seed;
    setReadyGeneration(seed);
    if (armStart) {
      setStartNonce((n) => n + 1);
    }
  };

  const next = useNextPuzzleId({
    currentPuzzleId: activePuzzleId() ?? roomPuzzleId(),
    seed: `${myId()}-${attemptSeed()}`,
  });

  createEffect(() => {
    const active = activePuzzleId();
    const seed = attemptSeed();
    const nextId = next.puzzleId();
    const room = roomPuzzleId();

    if (active === null) {
      if (seed === 0 && room !== null) {
        setActivePuzzleId(room);
        commitAttempt(seed, false);
      } else if (nextId !== null) {
        setActivePuzzleId(nextId);
        commitAttempt(seed, true);
      }
      return;
    }
    if (room !== null && room !== active) {
      setActivePuzzleId(room);
      commitAttempt(seed, false);
      return;
    }
    if (seed === placedAttemptRef.current) return;
    if (room !== null) {
      commitAttempt(seed, false);
      return;
    }
    if (nextId === null || nextId === active) return;
    setActivePuzzleId(nextId);
    commitAttempt(seed, true);
  });

  const onRequestNext = (): void => {
    setAttemptSeed((s) => s + 1);
  };

  const reselectActivePuzzleFromFeed = (): void => {
    dispatch(ClearChessPuzzlePlay({}));
    onRequestNext();
  };

  const e2eLoadingStatus = createMemo<ChessPuzzleE2ELoadingStatusProps>(() => ({
    myId: myId(),
    nextId: next.puzzleId(),
    activePuzzleId: activePuzzleId(),
    bandedCount: next.bandedCount(),
    fallbackCount: next.fallbackCount(),
    replayCount: next.replayCount,
    loading: next.loading(),
  }));

  return {
    backToChessRoot,
    activePuzzleId,
    attemptSeed,
    readyGeneration,
    startNonce,
    onRequestNext,
    reselectActivePuzzleFromFeed,
    e2eLoadingStatus,
  };
}
