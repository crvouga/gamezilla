import { useMyId } from '@libs/auth-client/use-current-user';
import { widenPuzzleFeedConfig } from '@libs/chess-puzzle-shared/chess-puzzle-feed-config';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  type ChessPuzzlePlayStatus,
} from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import { ClearChessPuzzlePlay } from '@libs/chess-puzzle-shared/chess-puzzle-play-messages';
import type { PuzzlePickState } from '@libs/chess-puzzle-shared/pick-state';
import {
  decidePuzzlePlacement,
  resolvePuzzlePickState,
} from '@libs/chess-puzzle-shared/pick-state';
import { LINKED_PUZZLE_PARAM } from '@libs/chess-puzzle-shared/puzzle-link';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@libs/chess-root-shared/chess-main-menu';
import { useUnlock } from '@libs/permissions-client/unlock';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import {
  useLocalSearchParams,
  usePathname,
  useRouter,
} from '@pkgs/ui-root-client/app-router';
import {
  type Accessor,
  batch,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from 'solid-js';
import { useChessPuzzleFeedState } from './chess-puzzle-feed-context';
import type { ChessPuzzleTestLoadingStatusProps } from './chess-puzzle-test-loading-status';
import { useChessPuzzleFeedConfig } from './use-chess-puzzle-feed-config';
import {
  useChessPuzzleRatingEvents,
  useIsPuzzleAlreadyRated,
} from './use-chess-puzzle-rating-events';
import { useNextPuzzleId } from './use-next-puzzle-id';
import { isFinishedPuzzleStatus } from './use-puzzle-player-handlers';
import { useIsPuzzleDriver } from './use-puzzle-space-role';
import type { RatedStartGate } from './use-rated-start-gate';
import { useRatedStartGate } from './use-rated-start-gate';

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
  /**
   * Put `puzzleId` (from a puzzle link) on the board as a new attempt,
   * unless it is there already and not `over`.
   */
  requestLinked: (puzzleId: string, over: boolean) => void;
  /** A linked puzzle could not start (its denial is the gate's). */
  linkedDenied: Accessor<boolean>;
  next: ReturnType<typeof useNextPuzzleId>;
};

/**
 * A driver opening a space whose puzzle is already finished moves on, the
 * same as Next: the played puzzle is not what their other device is served.
 */
function useAdvanceFinishedRoom(args: {
  canPick: Accessor<boolean>;
  roomFinished: Accessor<boolean>;
  roomPuzzleId: Accessor<string | null>;
  active: Accessor<string | null>;
  attemptSeed: Accessor<number>;
  /** Remember the finished puzzle, clear it, and ask for the next one. */
  advance: (finishedPuzzleId: string) => void;
}): void {
  const advanced: { current: boolean } = { current: false };
  createEffect(() => {
    if (advanced.current || !args.canPick()) return;
    if (args.attemptSeed() !== 0 || args.active() !== null) return;
    const finished = args.roomPuzzleId();
    if (!args.roomFinished() || finished === null) return;
    advanced.current = true;
    args.advance(finished);
  });
}

type PlacementCommit = {
  readonly seed: number;
  readonly decision: ReturnType<typeof decidePuzzlePlacement>;
  readonly gatedSeedRef: { current: number | null };
  readonly placedAttemptRef: { current: number };
  readonly alreadyRated: (puzzleId: string) => boolean;
  readonly gate: RatedStartGate;
  readonly attemptSeed: Accessor<number>;
  readonly linked: Accessor<string | null>;
  readonly setLinked: (puzzleId: string | null) => void;
  readonly setLinkedDenied: (denied: boolean) => void;
  readonly setActivePuzzleId: (puzzleId: string | null) => void;
  readonly commitAttempt: (seed: number, armStart: boolean) => void;
  readonly clearRoomPuzzle: () => void;
};

/** Apply one placement decision: arm a rated start, resume, or drop. */
function applyPlacement(args: PlacementCommit): void {
  const { decision, seed } = args;
  if (decision.kind === 'place' && decision.armStart) {
    if (args.gatedSeedRef.current === seed) return;
    args.gatedSeedRef.current = seed;
    // An unrated repeat uses no rated-puzzle start.
    const start = untrack(() => args.alreadyRated(decision.puzzleId))
      ? Promise.resolve(true)
      : args.gate.start(decision.puzzleId);
    void start.then((allowed) => {
      if (args.attemptSeed() !== seed) return;
      batch(() => {
        const wasLinked = decision.puzzleId === untrack(args.linked);
        if (wasLinked) args.setLinked(null);
        args.setLinkedDenied(wasLinked && !allowed);
        if (allowed) {
          args.setActivePuzzleId(decision.puzzleId);
          args.commitAttempt(seed, true);
          return;
        }
        args.placedAttemptRef.current = seed;
        args.setActivePuzzleId(null);
        args.clearRoomPuzzle();
      });
    });
    return;
  }
  if (decision.kind === 'place') {
    args.setActivePuzzleId(decision.puzzleId);
    args.commitAttempt(seed, false);
    return;
  }
  if (decision.kind === 'drop') {
    args.setActivePuzzleId(null);
    args.placedAttemptRef.current = seed;
  }
}

/**
 * Owns which puzzle is on screen. The room's puzzle id wins for spectators
 * and rejoins of an unfinished puzzle; the local picker fills the slot after
 * Next, a finished puzzle, or feed edits.
 */
type PuzzlePlacementInput = {
  myId: Accessor<string>;
  roomPuzzleId: Accessor<string | null>;
  roomFinished: Accessor<boolean>;
  roomResumable: Accessor<boolean>;
  poolReady: Accessor<boolean>;
  canPick: Accessor<boolean>;
  gate: RatedStartGate;
  /** Clears a finished puzzle when the next start is denied. */
  clearRoomPuzzle: () => void;
};

/** Opening a finished room moves on once, the same way Next does. */
function useSkipFinishedOpening(
  args: PuzzlePlacementInput,
  session: {
    active: Accessor<string | null>;
    attemptSeed: Accessor<number>;
    setAttemptSeed: (update: (seed: number) => number) => void;
    setAvoidFinishedId: (puzzleId: string) => void;
  }
): void {
  useAdvanceFinishedRoom({
    canPick: args.canPick,
    roomFinished: args.roomFinished,
    roomPuzzleId: args.roomPuzzleId,
    active: session.active,
    attemptSeed: session.attemptSeed,
    advance: (finishedPuzzleId) => {
      session.setAvoidFinishedId(finishedPuzzleId);
      args.clearRoomPuzzle();
      session.setAttemptSeed((seed) => seed + 1);
    },
  });
}

function usePuzzlePlacement(args: PuzzlePlacementInput): PuzzlePlacement {
  const [activePuzzleId, setActivePuzzleId] = createSignal<string | null>(null);
  const [linked, setLinked] = createSignal<string | null>(null);
  /** Finished room puzzle kept out of the pick after it is cleared. */
  const [avoidFinishedId, setAvoidFinishedId] = createSignal<string | null>(
    null
  );
  const ratingEvents = useChessPuzzleRatingEvents();
  /** A puzzle that already moved the rating: its repeat starts free. */
  const alreadyRated = (puzzleId: string): boolean =>
    ratingEvents().some((event) => event.puzzleId === puzzleId);
  const [linkedDenied, setLinkedDenied] = createSignal(false);
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
    currentPuzzleId: () =>
      activePuzzleId() ?? args.roomPuzzleId() ?? avoidFinishedId(),
    seed: () => `${args.myId()}-${attemptSeed()}`,
    poolReady: args.poolReady,
  });

  useSkipFinishedOpening(args, {
    active: activePuzzleId,
    attemptSeed,
    setAttemptSeed,
    setAvoidFinishedId,
  });

  createEffect(() => {
    applyPlacement({
      seed: attemptSeed(),
      decision: decidePuzzlePlacement({
        active: activePuzzleId(),
        seed: attemptSeed(),
        nextId: next.puzzleId(),
        room: args.roomPuzzleId(),
        nextLoading: next.loading(),
        placedSeed: placedAttemptRef.current,
        canPick: args.canPick(),
        linked: linked(),
        roomResumable: args.roomResumable(),
      }),
      gatedSeedRef,
      placedAttemptRef,
      alreadyRated,
      gate: args.gate,
      attemptSeed,
      linked,
      setLinked,
      setLinkedDenied,
      setActivePuzzleId,
      commitAttempt,
      clearRoomPuzzle: args.clearRoomPuzzle,
    });
  });

  return {
    activePuzzleId,
    attemptSeed,
    readyGeneration,
    startNonce,
    onRequestNext: () => setAttemptSeed((s) => s + 1),
    requestLinked: (puzzleId, over) => {
      const onBoard = untrack(activePuzzleId) === puzzleId;
      // The linked puzzle already being solved stays as it is.
      if (onBoard && !over) return;
      args.clearRoomPuzzle();
      batch(() => {
        // A finished attempt at it gives way to a fresh one.
        if (onBoard) setActivePuzzleId(null);
        setLinked(puzzleId);
        setAttemptSeed((s) => s + 1);
      });
    },
    linkedDenied,
    next,
  };
}

/**
 * A linked puzzle the day's allowance cannot start runs the denial's way
 * forward at once (signing in, for a guest), as the policy names it.
 */
function useUnlockDeniedLink(args: {
  linkedDenied: Accessor<boolean>;
  denial: Accessor<Decision | null>;
}): void {
  const unlock = useUnlock();
  createEffect(() => {
    const denial = args.denial();
    if (!args.linkedDenied() || denial === null) return;
    untrack(() => unlock.run(denial));
  });
}

/**
 * A space opened from a puzzle link (`?puzzle=<id>`) puts that puzzle on the
 * driver's board, then drops the request from the address so moving on
 * serves the feed again and reopening the link changes nothing.
 */
function useLinkedPuzzleRequest(args: {
  canPick: Accessor<boolean>;
  roomStatus: Accessor<ChessPuzzlePlayStatus>;
  requestLinked: (puzzleId: string, over: boolean) => void;
}): void {
  const params = useLocalSearchParams<{ puzzle?: string | undefined }>();
  const pathname = usePathname();
  const router = useRouter();
  createEffect(() => {
    const linked = params()[LINKED_PUZZLE_PARAM];
    if (linked === undefined || linked.length === 0 || !args.canPick()) return;
    untrack(() => {
      args.requestLinked(linked, isFinishedPuzzleStatus(args.roomStatus()));
      router.replace(pathname());
    });
  });
}

/** Puzzle links: place the linked puzzle, and unlock a denied one. */
function useLinkedPuzzles(args: {
  canPick: Accessor<boolean>;
  placement: PuzzlePlacement;
  denial: Accessor<Decision | null>;
}): void {
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  useUnlockDeniedLink({
    linkedDenied: args.placement.linkedDenied,
    denial: args.denial,
  });
  useLinkedPuzzleRequest({
    canPick: args.canPick,
    roomStatus,
    requestLinked: args.placement.requestLinked,
  });
}

function useDriverPlacement(
  myId: Accessor<string>,
  poolReady: Accessor<boolean>
): {
  canPick: Accessor<boolean>;
  gate: RatedStartGate;
  placement: PuzzlePlacement;
} {
  const dispatch = useSpaceRoomDispatch();
  const canPick = useIsPuzzleDriver();
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const roomFinished = createMemo(() => isFinishedPuzzleStatus(roomStatus()));
  const roomResumable = createMemo(
    () =>
      roomStatus() === CHESS_PUZZLE_PLAY_STATUS.solving ||
      roomStatus() === CHESS_PUZZLE_PLAY_STATUS.wrong
  );
  const requestNextRef: { current: () => void } = { current: () => {} };
  const gate = useRatedStartGate(() => requestNextRef.current());
  const placement = usePuzzlePlacement({
    myId,
    roomPuzzleId,
    roomFinished,
    roomResumable,
    poolReady,
    canPick,
    gate,
    clearRoomPuzzle: () => dispatch(ClearChessPuzzlePlay({})),
  });
  requestNextRef.current = placement.onRequestNext;
  return { canPick, gate, placement };
}

export function usePuzzlePlayScreenState(): PuzzlePlayScreenModel {
  const myId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const { status: syncStatus } = useSyncEngine();
  const { poolReady } = useChessPuzzleFeedState();
  const [, setFeedConfig] = useChessPuzzleFeedConfig();
  const { canPick, gate, placement } = useDriverPlacement(myId, poolReady);
  useLinkedPuzzles({ canPick, placement, denial: gate.denial });
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
