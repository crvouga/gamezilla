import { useMyId } from '@libs/auth-client/use-current-user';
import { PuzzlePlayAttr } from '@libs/game-puzzle-shared/play-attr';
import {
  ClearPuzzleRecommendation,
  ReclaimPuzzlePlay,
  RecommendPuzzleMove,
  StartPuzzlePlay,
} from '@libs/game-puzzle-shared/play-messages';
import { PuzzleResultAttr } from '@libs/game-puzzle-shared/play-result';
import {
  decidePuzzleSessionStart,
  shouldReclaimPuzzleHost,
} from '@libs/game-puzzle-shared/session-start-policy';
import { useSpacePresence } from '@libs/spaces-client/room-use-space-presence';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import { registerFeedbackContext } from '@pkgs/feedback-shared/context';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import type { PuzzleAttempt, PuzzleCoachLine } from './puzzle-client';
import { usePuzzleGame } from './puzzle-game-context';
import {
  usePuzzleAllInteractions,
  usePuzzleEntityAndInteractions,
} from './puzzle-play-queries';
import { usePuzzleAutoAdvance } from './use-puzzle-auto-advance';
import { usePuzzleClock } from './use-puzzle-clock';
import { usePuzzleCompletion } from './use-puzzle-completion';
import { usePuzzleInteractionRecorder } from './use-puzzle-interaction-recorder';
import { usePuzzlePlayerControls } from './use-puzzle-player-controls';
import { usePuzzleCoach } from './use-puzzle-player-presentation';
import { usePuzzlePlayerVisual } from './use-puzzle-player-visual';
import { usePuzzleRecommendations } from './use-puzzle-recommendations';
import { usePuzzleSolver } from './use-puzzle-solver';
import { useIsPuzzleDriver, usePuzzleSpaceRole } from './use-puzzle-space-role';

function useReclaimStalePuzzleHost(canDrive: Accessor<boolean>): void {
  const memberId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const roomStatus = useSpaceRoomSelector(PuzzlePlayAttr.status.from);
  const hostIdentity = useSpaceRoomSelector(PuzzlePlayAttr.hostIdentity.from);
  const roomSynced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const { peersByMemberId } = useSpacePresence();
  createEffect(() => {
    const reclaim = shouldReclaimPuzzleHost({
      canDrive: canDrive(),
      memberId: memberId(),
      roomStatus: roomStatus(),
      hostIdentity: hostIdentity(),
      roomSynced: roomSynced(),
      hostPresent:
        hostIdentity() !== null && peersByMemberId().has(hostIdentity()!),
    });
    if (reclaim) dispatch(ReclaimPuzzlePlay({}));
  });
}

/** True for the member the room recorded as the puzzle host (the one moving). */
function usePuzzleHostIdentityMatch(): Accessor<boolean> {
  const myId = useMyId();
  const hostIdentity = useSpaceRoomSelector(PuzzlePlayAttr.hostIdentity.from);
  return createMemo(() => {
    const host = hostIdentity();
    return host !== null && host === myId();
  });
}

function useStartPuzzleSessionOnMount(args: {
  canDrive: Accessor<boolean>;
  puzzleId: Accessor<string>;
  fen: Accessor<string>;
  movesStr: Accessor<string>;
  playGeneration: Accessor<number>;
  readyGeneration: Accessor<number>;
  startNonce: Accessor<number>;
}): void {
  const dispatch = useSpaceRoomDispatch();
  const roomStatus = useSpaceRoomSelector(PuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(PuzzlePlayAttr.puzzleId.from);
  const myId = useMyId();
  const lastStartedNonceRef: { current: number } = { current: 0 };
  createEffect(() => {
    const decision = decidePuzzleSessionStart({
      canDrive: args.canDrive(),
      identityReady: myId().length > 0,
      startNonce: args.startNonce(),
      lastStartedNonce: lastStartedNonceRef.current,
      playGeneration: args.playGeneration(),
      readyGeneration: args.readyGeneration(),
      roomStatus: roomStatus(),
      roomPuzzleId: roomPuzzleId(),
      fen: args.fen(),
      moves: args.movesStr(),
    });
    if (decision.kind === 'skip') return;
    lastStartedNonceRef.current = args.startNonce();
    if (decision.kind === 'start') {
      dispatch(
        StartPuzzlePlay({
          puzzleId: args.puzzleId(),
          fen: args.fen(),
          moves: args.movesStr(),
        })
      );
    }
  });
}

/**
 * Suggest-by-drag for watchers: a move on the board becomes a synced
 * suggestion of the cells it names (one cell names both ends).
 */
function usePuzzleRecommendDispatch(position: Accessor<string | null>): {
  recommendBump: Accessor<number>;
  onRecommendAction: (action: string) => void;
  onClearMyRecommendation: () => void;
} {
  const dispatch = useSpaceRoomDispatch();
  const { game } = usePuzzleGame();
  const [recommendBump, setRecommendBump] = createSignal(0);
  return {
    recommendBump,
    onRecommendAction: (action: string): void => {
      const at = position();
      const marks = at === null ? null : game.puzzles.marks(at, action);
      if (marks === null) return;
      const from = marks.from ?? marks.to;
      if (!game.puzzles.isCell(from) || !game.puzzles.isCell(marks.to)) return;
      dispatch(RecommendPuzzleMove({ from, to: marks.to }));
      // The board applied the drag optimistically; bump the sync key so it
      // snaps back to the room's position (the suggestion is only marks).
      setRecommendBump((n) => n + 1);
    },
    onClearMyRecommendation: (): void => {
      dispatch(ClearPuzzleRecommendation({}));
    },
  };
}

function usePuzzlePlayerModel(args: {
  puzzleId: Accessor<string>;
  playGeneration: Accessor<number>;
  readyGeneration: Accessor<number>;
  startNonce: Accessor<number>;
}) {
  const canDrive = useIsPuzzleDriver();
  const entity = usePuzzleEntityAndInteractions(args.puzzleId);
  const fen = createMemo(() => entity.fen);
  const movesStr = createMemo(() => entity.movesStr);
  const rating = createMemo(() => entity.rating);
  const ratingDeviation = createMemo(() => entity.ratingDeviation);
  const themes = createMemo(() => entity.themes);
  const interactions = createMemo(() => entity.interactions);
  const interactionsReady = createMemo(() => entity.interactionsReady);
  const allInteractions = usePuzzleAllInteractions();
  const startedAtMs = useSpaceRoomSelector(PuzzlePlayAttr.startedAtMs.from);
  const endedAtMs = useSpaceRoomSelector(PuzzlePlayAttr.endedAtMs.from);
  const hostIdentity = useSpaceRoomSelector(PuzzlePlayAttr.hostIdentity.from);
  useReclaimStalePuzzleHost(canDrive);
  useStartPuzzleSessionOnMount({
    canDrive,
    puzzleId: args.puzzleId,
    fen,
    movesStr,
    playGeneration: args.playGeneration,
    readyGeneration: args.readyGeneration,
    startNonce: args.startNonce,
  });
  const solver = usePuzzleSolver({ puzzleId: args.puzzleId });
  const isPuzzleHost = usePuzzleHostIdentityMatch();
  const recorder = usePuzzleInteractionRecorder({
    puzzleId: args.puzzleId,
    puzzleRating: rating,
    puzzleRatingDeviation: ratingDeviation,
    status: solver.status,
    solveIdx: solver.solveIdx,
    interactions,
    interactionsReady,
    canRecord: isPuzzleHost,
    attemptKey: useSpaceRoomSelector(PuzzleResultAttr.attempt.from),
  });

  return {
    puzzleId: args.puzzleId,
    rating,
    ratingDeviation,
    themes,
    interactions,
    allInteractions,
    movesStr,
    initialPosition: fen,
    displayPosition: solver.displayPosition,
    boardPosition: solver.boardPosition,
    layoutKey: solver.layoutKey,
    status: solver.status,
    orientation: solver.orientation,
    onMoveRaw: solver.onMove,
    solveIdx: solver.solveIdx,
    furthestSolveIdx: solver.furthestSolveIdx,
    totalTokens: solver.totalTokens,
    wrongAction: solver.wrongAction,
    wrongMark: solver.wrongMark,
    hintFrom: solver.hintFrom,
    hintTo: solver.hintTo,
    nextAction: solver.nextAction,
    solutionRevealed: solver.solutionRevealed,
    opponentAnimating: solver.opponentAnimating,
    appendUsedHint: recorder.appendUsedHint,
    setLastAction: recorder.setLastAction,
    startedAtMs,
    endedAtMs,
    hostIdentity,
    canDrive,
    isPuzzleHost,
  };
}

function usePuzzlePlayerUi(args: {
  puzzleId: Accessor<string>;
  onRequestNext: () => void;
  m: ReturnType<typeof usePuzzlePlayerModel>;
}) {
  const myId = useMyId();
  const completion = usePuzzleCompletion({
    puzzleId: args.m.puzzleId,
    interactions: args.m.interactions,
    allInteractions: args.m.allInteractions,
    status: args.m.status,
  });
  const controls = usePuzzlePlayerControls({
    puzzleId: args.m.puzzleId,
    moves: args.m.movesStr,
    solveIdx: args.m.solveIdx,
    furthestSolveIdx: args.m.furthestSolveIdx,
    status: args.m.status,
    hintFrom: args.m.hintFrom,
    solutionRevealed: args.m.solutionRevealed,
    onMoveRaw: args.m.onMoveRaw,
    setLastAction: args.m.setLastAction,
    appendUsedHint: args.m.appendUsedHint,
    onRequestNext: args.onRequestNext,
  });
  usePuzzleAutoAdvance({
    status: args.m.status,
    canDrive: args.m.isPuzzleHost,
    onNext: controls.onNext,
  });
  const visual = usePuzzlePlayerVisual({
    status: args.m.status,
    wrongMark: args.m.wrongMark,
    hintFrom: args.m.hintFrom,
    hintTo: args.m.hintTo,
    hintStage: controls.hintStage,
    atFrontier: controls.atFrontier,
  });
  const recommendations = usePuzzleRecommendations({
    excludeMemberId: () => (args.m.isPuzzleHost() ? null : myId()),
  });
  const clock = usePuzzleClock({
    status: args.m.status,
    startedAtMs: args.m.startedAtMs,
    endedAtMs: args.m.endedAtMs,
  });
  const recommend = usePuzzleRecommendDispatch(args.m.displayPosition);
  const spaceRole = usePuzzleSpaceRole();
  const recommendationProbe = createMemo(() =>
    recommendations
      .entries()
      .map((entry) => `${entry.by}:${entry.from}${entry.to}`)
      .join(',')
  );

  return frozenPlayerModel({
    m: args.m,
    controls,
    visual,
    completion,
    recommendations,
    clock,
    recommend,
    spaceRole,
    recommendationProbe,
    puzzleId: args.m.puzzleId,
  });
}

function frozenPlayerModel(args: {
  m: ReturnType<typeof usePuzzlePlayerModel>;
  controls: ReturnType<typeof usePuzzlePlayerControls>;
  visual: ReturnType<typeof usePuzzlePlayerVisual>;
  completion: ReturnType<typeof usePuzzleCompletion>;
  recommendations: ReturnType<typeof usePuzzleRecommendations>;
  clock: ReturnType<typeof usePuzzleClock>;
  recommend: ReturnType<typeof usePuzzleRecommendDispatch>;
  spaceRole: ReturnType<typeof usePuzzleSpaceRole>;
  recommendationProbe: Accessor<string>;
  puzzleId: Accessor<string>;
}) {
  const { m, controls, visual, completion, recommendations, clock, recommend } =
    args;
  return {
    completion,
    puzzleId: m.puzzleId,
    rating: m.rating,
    themes: m.themes,
    backToRoot: controls.backToRoot,
    statusKind: visual.statusKind,
    displayPosition: m.displayPosition,
    boardPosition: m.boardPosition,
    layoutKey: m.layoutKey,
    orientation: m.orientation,
    status: m.status,
    atFrontier: controls.atFrontier,
    opponentAnimating: m.opponentAnimating,
    hintStage: controls.hintStage,
    canGoBack: controls.canGoBack,
    canGoForward: controls.canGoForward,
    onMove: controls.onMove,
    marks: visual.marks,
    onHint: controls.onHint,
    onSolution: controls.onSolution,
    onBack: controls.onBack,
    onForward: controls.onForward,
    onRetry: controls.onRetry,
    onSkip: controls.onSkip,
    onNext: controls.onNext,
    hintFrom: m.hintFrom,
    hintTo: m.hintTo,
    nextAction: m.nextAction,
    wrongAction: m.wrongAction,
    solveIdx: m.solveIdx,
    movesStr: m.movesStr,
    hostIdentity: m.hostIdentity,
    isSpectator: createMemo(
      () => m.status() !== 'loading' && m.isPuzzleHost() === false
    ),
    clockElapsedMs: clock.elapsedMs,
    clockRunning: clock.running,
    recommendationEntries: recommendations.entries,
    suggestions: recommendations.suggestions,
    recommendationColorFor: recommendations.colorFor,
    onRecommendAction: recommend.onRecommendAction,
    onClearMyRecommendation: recommend.onClearMyRecommendation,
    recommendBump: recommend.recommendBump,
    spaceRole: args.spaceRole,
    recommendationProbe: args.recommendationProbe,
  };
}

export type PuzzlePlayerUiModel = ReturnType<typeof frozenPlayerModel>;

export type PuzzlePlayerChromeModel = PuzzlePlayerUiModel & {
  /** The attempt as the game's coach and companion see it. */
  readonly attempt: PuzzleAttempt;
  readonly coach: Accessor<PuzzleCoachLine | null>;
};

/** The attempt on the board, as the game's coach and companion read it. */
function usePuzzleAttempt(p: PuzzlePlayerUiModel): PuzzleAttempt {
  return {
    puzzleId: p.puzzleId,
    status: p.status,
    line: p.movesStr,
    solveIdx: p.solveIdx,
    layoutKey: p.layoutKey,
    position: p.displayPosition,
    solverSide: p.orientation,
    hintStage: p.hintStage,
    hintFrom: p.hintFrom,
    hintTo: p.hintTo,
    nextAction: p.nextAction,
    wrongAction: p.wrongAction,
    interactive: createMemo(
      () =>
        !p.isSpectator() &&
        p.status() === 'solving' &&
        p.atFrontier() &&
        !p.opponentAnimating()
    ),
    opponentReplying: p.opponentAnimating,
    viewingHistory: () => !p.atFrontier(),
    spectating: p.isSpectator,
    spaceRole: p.spaceRole,
    statusKind: p.statusKind,
    clockElapsedMs: p.clockElapsedMs,
    rating: p.rating,
    themes: p.themes,
    suggestionsProbe: p.recommendationProbe,
    completion: p.completion,
  };
}

export function usePuzzlePlayerState(args: {
  puzzleId: Accessor<string>;
  playGeneration: Accessor<number>;
  readyGeneration: Accessor<number>;
  startNonce: Accessor<number>;
  onRequestNext: () => void;
}): PuzzlePlayerChromeModel {
  const m = usePuzzlePlayerModel({
    puzzleId: args.puzzleId,
    playGeneration: args.playGeneration,
    readyGeneration: args.readyGeneration,
    startNonce: args.startNonce,
  });
  const ui = usePuzzlePlayerUi({
    puzzleId: args.puzzleId,
    onRequestNext: args.onRequestNext,
    m,
  });
  onCleanup(
    registerFeedbackContext({
      name: 'chess-puzzle',
      collect: () => ({
        puzzleId: m.puzzleId(),
        solutionMoves: m.movesStr(),
        initialPosition: m.initialPosition(),
        displayPosition: m.displayPosition(),
        orientation: m.orientation(),
        status: m.status(),
        solveIndex: m.solveIdx(),
        furthestSolveIndex: m.furthestSolveIdx(),
        hintStage: ui.hintStage(),
        playGeneration: args.playGeneration(),
        readyGeneration: args.readyGeneration(),
      }),
    })
  );
  const attempt = usePuzzleAttempt(ui);
  return { ...ui, attempt, coach: usePuzzleCoach(attempt) };
}
