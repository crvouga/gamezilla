import { useMyId } from '@libs/auth/public/use-current-user';
import type { Decision } from '@libs/permissions/public/use-permissions';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import { useSyncEngine } from '@pkgs/sync-engine/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';

import {
  decidePuzzlePlacement,
  type PuzzlePickState,
  resolvePuzzlePickState,
} from '../../shared/puzzle-session/pick-state';
import { CHESS_SCREEN, SetChessMainMenuScreen } from '../chess-main-menu';
import { widenPuzzleFeedConfig } from '../chess-puzzle-feed-config';
import {
  ChessPuzzlePlayAttr,
  ClearChessPuzzlePlay,
} from '../chess-puzzle-play';
import { useChessPuzzleFeedState } from './chess-puzzle-feed-context';
import type { ChessPuzzleTestLoadingStatusProps } from './chess-puzzle-test-loading-status';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import { useIsPuzzleAlreadyRated } from './use-chess-puzzle-rating-events';
import { useNextPuzzleId } from './use-next-puzzle-id';
import { useIsPuzzleDriver } from './use-puzzle-space-role';
import { type RatedStartGate, useRatedStartGate } from './use-rated-start-gate';

export type PuzzlePlayScreenModel = {
  backToChessRoot: () => void;
  activePuzzleId: Accessor<string | null>;
  pickState: Accessor<PuzzlePickState>;
  /** Watching the host's puzzle; owns no picker and no controls. */
  isSpectator: Accessor<boolean>;
  attemptSeed: Accessor<number>;
  readyGeneration: Accessor<number>;
  startNonce: Accessor<number>;
  onRequestNext: () => void;
  reselectActivePuzzleFromFeed: () => void;
  /** Drop history / theme filters, then re-pick from the widened feed. */
  includeAllPuzzles: () => void;
  testLoadingStatus: Accessor<ChessPuzzleTestLoadingStatusProps>;
  /** Why the last start was denied (renders the denial surface). */
  startDenial: Accessor<Decision | null>;
};

type PuzzlePlacement = {
  activePuzzleId: Accessor<string | null>;
  attemptSeed: Accessor<number>;
  readyGeneration: Accessor<number>;
  startNonce: Accessor<number>;
  onRequestNext: () => void;
  next: ReturnType<typeof useNextPuzzleId>;
};

/**
 * Owns which puzzle is on screen. The room's puzzle id wins for spectators
 * and rejoins; the local picker fills the slot after Next / feed edits.
 */
function usePuzzlePlacement(args: {
  myId: Accessor<string>;
  roomPuzzleId: Accessor<string | null>;
  poolReady: Accessor<boolean>;
  canPick: Accessor<boolean>;
  gate: RatedStartGate;
  /** Clears a finished puzzle when the next start is denied. */
  clearRoomPuzzle: () => void;
}): PuzzlePlacement {
  const [activePuzzleId, setActivePuzzleId] = createSignal<string | null>(null);
  const [attemptSeed, setAttemptSeed] = createSignal(0);
  const [readyGeneration, setReadyGeneration] = createSignal(0);
  const [startNonce, setStartNonce] = createSignal(0);
  const placedAttemptRef: { current: number } = { current: 0 };
  /** Seed whose start is being consumed / was denied: never re-consumed. */
  const gatedSeedRef: { current: number | null } = { current: null };

  const commitAttempt = (seed: number, armStart: boolean): void => {
    placedAttemptRef.current = seed;
    setReadyGeneration(seed);
    if (armStart) setStartNonce((n) => n + 1);
  };

  const next = useNextPuzzleId({
    currentPuzzleId: () => activePuzzleId() ?? args.roomPuzzleId(),
    seed: () => `${args.myId()}-${attemptSeed()}`,
    poolReady: args.poolReady,
  });

  createEffect(() => {
    const seed = attemptSeed();
    const decision = decidePuzzlePlacement({
      active: activePuzzleId(),
      seed,
      nextId: next.puzzleId(),
      room: args.roomPuzzleId(),
      nextLoading: next.loading(),
      placedSeed: placedAttemptRef.current,
      canPick: args.canPick(),
    });
    if (decision.kind === 'place' && decision.armStart) {
      if (gatedSeedRef.current === seed) return;
      gatedSeedRef.current = seed;
      void args.gate.start(decision.puzzleId).then((allowed) => {
        if (attemptSeed() !== seed) return;
        if (allowed) {
          setActivePuzzleId(decision.puzzleId);
          commitAttempt(seed, true);
          return;
        }
        placedAttemptRef.current = seed;
        setActivePuzzleId(null);
        args.clearRoomPuzzle();
      });
    } else if (decision.kind === 'place') {
      setActivePuzzleId(decision.puzzleId);
      commitAttempt(seed, false);
    } else if (decision.kind === 'drop') {
      setActivePuzzleId(null);
      placedAttemptRef.current = seed;
    }
  });

  return {
    activePuzzleId,
    attemptSeed,
    readyGeneration,
    startNonce,
    onRequestNext: () => setAttemptSeed((s) => s + 1),
    next,
  };
}

export function usePuzzlePlayScreenState(): PuzzlePlayScreenModel {
  const myId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const { status: syncStatus } = useSyncEngine();
  const { poolReady } = useChessPuzzleFeedState();
  const [, setFeedConfig] = useChessPuzzleFeedConfig();
  const canPick = useIsPuzzleDriver();
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
  const requestNextRef: { current: () => void } = { current: () => {} };
  const gate = useRatedStartGate(() => requestNextRef.current());
  const placement = usePuzzlePlacement({
    myId,
    roomPuzzleId,
    poolReady,
    canPick,
    gate,
    clearRoomPuzzle: () => dispatch(ClearChessPuzzlePlay({})),
  });
  requestNextRef.current = placement.onRequestNext;
  const { next } = placement;

  const backToChessRoot = (): void => {
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  };

  const pickState = createMemo<PuzzlePickState>(() => {
    if (!canPick()) {
      return placement.activePuzzleId() === null ? 'waiting' : 'ready';
    }
    return resolvePuzzlePickState({
      activePuzzleId: placement.activePuzzleId(),
      nextPuzzleId: next.puzzleId(),
      loading: next.loading(),
      localPuzzleTotal: next.localPuzzleTotal(),
      online: syncStatus().online,
      limitReached: canPick() && gate.denial() !== null,
    });
  });

  const reselectActivePuzzleFromFeed = (): void => {
    dispatch(ClearChessPuzzlePlay({}));
    placement.onRequestNext();
  };

  const includeAllPuzzles = (): void => {
    setFeedConfig(widenPuzzleFeedConfig);
    reselectActivePuzzleFromFeed();
  };

  const alreadyRated = useIsPuzzleAlreadyRated(
    () => placement.activePuzzleId() ?? ''
  );
  const testLoadingStatus = createMemo<ChessPuzzleTestLoadingStatusProps>(
    () => ({
      myId: myId(),
      nextId: next.puzzleId(),
      activePuzzleId: placement.activePuzzleId(),
      pickState: pickState(),
      bandedCount: next.bandedCount(),
      fallbackCount: next.fallbackCount(),
      poolReady: poolReady(),
      loading: next.loading(),
      halfWindow: next.halfWindow(),
      source: next.source(),
      rated: !alreadyRated(),
    })
  );

  return {
    backToChessRoot,
    activePuzzleId: placement.activePuzzleId,
    pickState,
    isSpectator: createMemo(
      () => !canPick() && placement.activePuzzleId() !== null
    ),
    attemptSeed: placement.attemptSeed,
    readyGeneration: placement.readyGeneration,
    startNonce: placement.startNonce,
    onRequestNext: placement.onRequestNext,
    reselectActivePuzzleFromFeed,
    includeAllPuzzles,
    testLoadingStatus,
    startDenial: gate.denial,
  };
}
