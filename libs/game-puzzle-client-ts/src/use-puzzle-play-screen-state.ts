import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { widenPuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import type { PuzzlePickState } from '@libs/game-puzzle-shared-ts/pick-state';
import {
  decidePuzzlePlacement,
  resolvePuzzlePickState,
} from '@libs/game-puzzle-shared-ts/pick-state';
import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
  type PuzzlePlayStatus,
} from '@libs/game-puzzle-shared-ts/play-attr';
import { ClearPuzzlePlay } from '@libs/game-puzzle-shared-ts/play-messages';
import { LINKED_PUZZLE_PARAM } from '@libs/game-puzzle-shared-ts/puzzle-link';
import { useUnlock } from '@libs/permissions-client-ts/unlock';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client-ts/use-space-room-selector';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import {
  useLocalSearchParams,
  usePathname,
  useRouter,
} from '@pkgs/ui-root-client-ts/app-router';
import {
  type Accessor,
  batch,
  createEffect,
  createMemo,
  createSignal,
  type Setter,
  untrack,
} from 'solid-js';
import { usePuzzleFeedState } from './puzzle-feed-context';
import type { PuzzleTestLoadingStatusProps } from './puzzle-test-loading-status';
import { useNextPuzzleId } from './use-next-puzzle-id';
import { usePuzzleAttemptMemory } from './use-puzzle-attempt-memory';
import { usePuzzleFeedConfig } from './use-puzzle-feed-config';
import { isFinishedPuzzleStatus } from './use-puzzle-player-handlers';
import {
  useIsPuzzleAlreadyRated,
  usePuzzleRatingEvents,
} from './use-puzzle-rating-events';
import { usePuzzleResultRecorded } from './use-puzzle-result-recorded';
import { useIsPuzzleDriver } from './use-puzzle-space-role';
import type { RatedStartGate } from './use-rated-start-gate';
import { useRatedStartGate } from './use-rated-start-gate';

export type PuzzlePlayScreenModel = {
  backToRoot: () => void;
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
  testLoadingStatus: Accessor<PuzzleTestLoadingStatusProps>;
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
 * and rejoins, including a finished attempt; the local picker fills the slot
 * after the person moves on or edits the feed.
 */
type PuzzlePlacementInput = {
  myId: Accessor<string>;
  roomPuzzleId: Accessor<string | null>;
  roomResumable: Accessor<boolean>;
  roomReady: Accessor<boolean>;
  roomFinished: Accessor<boolean>;
  seenAttempt: Accessor<boolean>;
  poolReady: Accessor<boolean>;
  canPick: Accessor<boolean>;
  gate: RatedStartGate;
  /** Clears a finished puzzle when the next start is denied. */
  clearRoomPuzzle: () => void;
};

function useAdvanceFinishedPuzzle(
  args: PuzzlePlacementInput,
  state: {
    activePuzzleId: Accessor<string | null>;
    attemptSeed: Accessor<number>;
    recorded: Accessor<boolean>;
    setAvoidFinishedId: Setter<string | null>;
    setAttemptSeed: Setter<number>;
  }
): void {
  createEffect(() => {
    if (
      !args.roomReady() ||
      !state.recorded() ||
      !args.canPick() ||
      !args.roomFinished() ||
      args.seenAttempt()
    )
      return;
    if (state.activePuzzleId() !== null || state.attemptSeed() !== 0) return;
    const finished = args.roomPuzzleId();
    if (finished === null) return;
    batch(() => {
      state.setAvoidFinishedId(finished);
      args.clearRoomPuzzle();
      state.setAttemptSeed((seed) => seed + 1);
    });
  });
}

function createLinkedPuzzleRequest(state: {
  activePuzzleId: Accessor<string | null>;
  setActivePuzzleId: Setter<string | null>;
  setLinked: Setter<string | null>;
  setAttemptSeed: Setter<number>;
  clearRoomPuzzle: () => void;
}): PuzzlePlacement['requestLinked'] {
  return (puzzleId, over) => {
    const onBoard = untrack(state.activePuzzleId) === puzzleId;
    if (onBoard && !over) return;
    state.clearRoomPuzzle();
    batch(() => {
      if (onBoard) state.setActivePuzzleId(null);
      state.setLinked(puzzleId);
      state.setAttemptSeed((seed) => seed + 1);
    });
  };
}

function useAlreadyRatedPuzzle(): (puzzleId: string) => boolean {
  const ratingEvents = usePuzzleRatingEvents();
  return (puzzleId) =>
    ratingEvents().some((event) => event.puzzleId === puzzleId);
}

function usePuzzlePlacement(args: PuzzlePlacementInput): PuzzlePlacement {
  const [activePuzzleId, setActivePuzzleId] = createSignal<string | null>(null);
  const [linked, setLinked] = createSignal<string | null>(null);
  const [avoidFinishedId, setAvoidFinishedId] = createSignal<string | null>(
    null
  );
  const alreadyRated = useAlreadyRatedPuzzle();
  const resultRecord = usePuzzleResultRecorded(args.roomPuzzleId);
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

  useAdvanceFinishedPuzzle(args, {
    activePuzzleId,
    attemptSeed,
    recorded: resultRecord.recorded,
    setAvoidFinishedId,
    setAttemptSeed,
  });

  createEffect(() => {
    if (!args.roomReady()) return;
    if (args.roomFinished() && !args.seenAttempt() && !resultRecord.ready())
      return;
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
    requestLinked: createLinkedPuzzleRequest({
      activePuzzleId,
      setActivePuzzleId,
      setLinked,
      setAttemptSeed,
      clearRoomPuzzle: args.clearRoomPuzzle,
    }),
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
  activePuzzleId: Accessor<string | null>;
  roomStatus: Accessor<PuzzlePlayStatus>;
  requestLinked: (puzzleId: string, over: boolean) => void;
}): void {
  const params = useLocalSearchParams<{ puzzle?: string | undefined }>();
  const pathname = usePathname();
  const router = useRouter();
  const requested = { current: null as string | null };
  createEffect(() => {
    const linked = params()[LINKED_PUZZLE_PARAM];
    if (linked === undefined || linked.length === 0 || !args.canPick()) return;
    if (requested.current !== linked) {
      requested.current = linked;
      untrack(() =>
        args.requestLinked(linked, isFinishedPuzzleStatus(args.roomStatus()))
      );
    }
    if (
      args.activePuzzleId() === linked &&
      args.roomStatus() !== PUZZLE_PLAY_STATUS.idle
    )
      untrack(() => router.replace(pathname()));
  });
}

/** Puzzle links: place the linked puzzle, and unlock a denied one. */
function useLinkedPuzzles(args: {
  canPick: Accessor<boolean>;
  placement: PuzzlePlacement;
  denial: Accessor<Decision | null>;
}): void {
  const roomStatus = useSpaceRoomSelector(PuzzlePlayAttr.status.from);
  useUnlockDeniedLink({
    linkedDenied: args.placement.linkedDenied,
    denial: args.denial,
  });
  useLinkedPuzzleRequest({
    canPick: args.canPick,
    activePuzzleId: args.placement.activePuzzleId,
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
  const roomPuzzleId = useSpaceRoomSelector(PuzzlePlayAttr.puzzleId.from);
  const roomStatus = useSpaceRoomSelector(PuzzlePlayAttr.status.from);
  const roomSynced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const { status: syncStatus } = useSyncEngine();
  const memory = usePuzzleAttemptMemory();
  const roomResumable = createMemo(
    () => roomStatus() !== PUZZLE_PLAY_STATUS.idle
  );
  const requestNextRef: { current: () => void } = { current: () => {} };
  const gate = useRatedStartGate(() => requestNextRef.current());
  const placement = usePuzzlePlacement({
    myId,
    roomPuzzleId,
    roomResumable,
    roomReady: () =>
      memory.ready() &&
      (roomSynced() ||
        roomStatus() !== PUZZLE_PLAY_STATUS.idle ||
        !syncStatus().online),
    roomFinished: () => isFinishedPuzzleStatus(roomStatus()),
    seenAttempt: memory.seen,
    poolReady,
    canPick,
    gate,
    clearRoomPuzzle: () => dispatch(ClearPuzzlePlay({})),
  });
  requestNextRef.current = placement.onRequestNext;
  return { canPick, gate, placement };
}

export function usePuzzlePlayScreenState(): PuzzlePlayScreenModel {
  const myId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const gameScreen = useGameScreen();
  const { status: syncStatus } = useSyncEngine();
  const { poolReady } = usePuzzleFeedState();
  const [, setFeedConfig] = usePuzzleFeedConfig();
  const { canPick, gate, placement } = useDriverPlacement(myId, poolReady);
  useLinkedPuzzles({ canPick, placement, denial: gate.denial });
  const { next } = placement;

  const backToRoot = (): void => {
    gameScreen.showChoices();
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
    dispatch(ClearPuzzlePlay({}));
    placement.onRequestNext();
  };

  const includeAllPuzzles = (): void => {
    setFeedConfig(widenPuzzleFeedConfig);
    reselectActivePuzzleFromFeed();
  };

  const alreadyRated = useIsPuzzleAlreadyRated(
    () => placement.activePuzzleId() ?? ''
  );
  const testLoadingStatus = createMemo<PuzzleTestLoadingStatusProps>(() => ({
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
  }));

  return {
    backToRoot,
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
