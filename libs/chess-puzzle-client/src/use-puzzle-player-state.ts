import { useMyId } from '@libs/auth-client/use-current-user';
import { useSpacePresence } from '@libs/spaces-client/room-use-space-presence';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { formatUci } from '@pkgs/chess-rules-shared/uci';
import { registerFeedbackContext } from '@pkgs/feedback-shared/context';
import { RoomMetaAttr } from '@pkgs/room-client/room-meta';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';

import { isBoardSquare } from '@libs/chess-puzzle-shared/recommendations';
import {
  decidePuzzleSessionStart,
  shouldReclaimPuzzleHost,
} from '@libs/chess-puzzle-shared/session-start-policy';

import { ChessPuzzlePlayAttr } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import { ChessPuzzleResultAttr } from '@libs/chess-puzzle-shared/chess-puzzle-result';
import { ClearChessPuzzleRecommendation, ReclaimChessPuzzlePlay, RecommendChessPuzzleMove, StartChessPuzzlePlay } from '@libs/chess-puzzle-shared/chess-puzzle-play-messages';
import {
  useChessPuzzleAllInteractions,
  usePuzzleEntityAndInteractions,
} from './chess-puzzle-play-queries';
import { useChessPuzzleCompletion } from './use-chess-puzzle-completion';
import { useChessPuzzleInteractionRecorder } from './use-chess-puzzle-interaction-recorder';
import { usePuzzleSolver } from './use-chess-puzzle-solver';
import { usePuzzleAutoAdvance } from './use-puzzle-auto-advance';
import { usePuzzleClock } from './use-puzzle-clock';
import { usePuzzlePlayerControls } from './use-puzzle-player-controls';
import { usePuzzlePlayerVisual } from './use-puzzle-player-visual';
import { usePuzzleRecommendations } from './use-puzzle-recommendations';
import { useIsPuzzleDriver, usePuzzleSpaceRole } from './use-puzzle-space-role';

function useReclaimStalePuzzleHost(canDrive: Accessor<boolean>): void {
  const memberId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const hostIdentity = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.hostIdentity.from
  );
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
    if (reclaim) dispatch(ReclaimChessPuzzlePlay({}));
  });
}

/** True for the member the room recorded as the puzzle host (the one moving). */
function usePuzzleHostIdentityMatch(): Accessor<boolean> {
  const myId = useMyId();
  const hostIdentity = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.hostIdentity.from
  );
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
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
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
        StartChessPuzzlePlay({
          puzzleId: args.puzzleId(),
          fen: args.fen(),
          moves: args.movesStr(),
        })
      );
    }
  });
}

/** Suggest-by-drag for spectators: a legal drag becomes a synced arrow. */
function usePuzzleRecommendDispatch(): {
  recommendBump: Accessor<number>;
  onRecommendMove: (m: Move) => void;
  onClearMyRecommendation: () => void;
} {
  const dispatch = useSpaceRoomDispatch();
  const [recommendBump, setRecommendBump] = createSignal(0);
  return {
    recommendBump,
    onRecommendMove: (m: Move): void => {
      const uci = formatUci(m);
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      if (!isBoardSquare(from) || !isBoardSquare(to)) return;
      dispatch(RecommendChessPuzzleMove({ from, to }));
      // The board applied the drag optimistically; bump the sync key so it
      // snaps back to the room's position (the suggestion is only an arrow).
      setRecommendBump((n) => n + 1);
    },
    onClearMyRecommendation: (): void => {
      dispatch(ClearChessPuzzleRecommendation({}));
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
  const allInteractions = useChessPuzzleAllInteractions();
  const startedAtMs = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.startedAtMs.from
  );
  const endedAtMs = useSpaceRoomSelector(ChessPuzzlePlayAttr.endedAtMs.from);
  const hostIdentity = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.hostIdentity.from
  );
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
  const recorder = useChessPuzzleInteractionRecorder({
    puzzleId: args.puzzleId,
    puzzleRating: rating,
    puzzleRatingDeviation: ratingDeviation,
    status: solver.status,
    solveIdx: solver.solveIdx,
    interactions,
    interactionsReady,
    canRecord: isPuzzleHost,
    attemptKey: useSpaceRoomSelector(ChessPuzzleResultAttr.attempt.from),
  });

  return {
    puzzleId: args.puzzleId,
    rating,
    ratingDeviation,
    themes,
    interactions,
    allInteractions,
    movesStr,
    initialFen: fen,
    displayFen: solver.displayFen,
    layoutKey: solver.layoutKey,
    status: solver.status,
    orientation: solver.orientation,
    onMoveRaw: solver.onMove,
    solveIdx: solver.solveIdx,
    furthestSolveIdx: solver.furthestSolveIdx,
    totalTokens: solver.totalTokens,
    wrongUci: solver.wrongUci,
    wrongFromSquare: solver.wrongFromSquare,
    wrongToSquare: solver.wrongToSquare,
    expectedFromSquare: solver.expectedFromSquare,
    expectedToSquare: solver.expectedToSquare,
    solutionUci: solver.solutionUci,
    solutionRevealed: solver.solutionRevealed,
    opponentAnimating: solver.opponentAnimating,
    appendUsedHint: recorder.appendUsedHint,
    setLastUci: recorder.setLastUci,
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
  const completion = useChessPuzzleCompletion({
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
    expectedFromSquare: args.m.expectedFromSquare,
    solutionRevealed: args.m.solutionRevealed,
    onMoveRaw: args.m.onMoveRaw,
    setLastUci: args.m.setLastUci,
    appendUsedHint: args.m.appendUsedHint,
    onRequestNext: args.onRequestNext,
  });
  usePuzzleAutoAdvance({
    status: args.m.status,
    canDrive: args.m.isPuzzleHost,
    onNext: controls.onNext,
  });
  const visual = usePuzzlePlayerVisual({
    puzzleId: args.m.puzzleId,
    status: args.m.status,
    solveIdx: args.m.solveIdx,
    layoutKey: args.m.layoutKey,
    displayFen: args.m.displayFen,
    wrongUci: args.m.wrongUci,
    wrongFromSquare: args.m.wrongFromSquare,
    wrongToSquare: args.m.wrongToSquare,
    expectedFromSquare: args.m.expectedFromSquare,
    expectedToSquare: args.m.expectedToSquare,
    hintStage: controls.hintStage,
    atFrontier: controls.atFrontier,
    opponentReplying: args.m.opponentAnimating,
    viewingHistory: () => !controls.atFrontier(),
  });
  const recommendations = usePuzzleRecommendations({
    excludeMemberId: () => (args.m.isPuzzleHost() ? null : myId()),
  });
  const clock = usePuzzleClock({
    status: args.m.status,
    startedAtMs: args.m.startedAtMs,
    endedAtMs: args.m.endedAtMs,
  });
  const recommend = usePuzzleRecommendDispatch();
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
  completion: ReturnType<typeof useChessPuzzleCompletion>;
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
    assistant: visual.assistant,
    statusKind: visual.statusKind,
    displayFen: m.displayFen,
    layoutKey: m.layoutKey,
    orientation: m.orientation,
    status: m.status,
    atFrontier: controls.atFrontier,
    opponentAnimating: m.opponentAnimating,
    hintStage: controls.hintStage,
    canGoBack: controls.canGoBack,
    canGoForward: controls.canGoForward,
    onMove: controls.onMove,
    cellFeedback: visual.cellFeedback,
    cellHighlights: visual.cellHighlights,
    arrows: visual.arrows,
    onHint: controls.onHint,
    onSolution: controls.onSolution,
    onBack: controls.onBack,
    onForward: controls.onForward,
    onRetry: controls.onRetry,
    onSkip: controls.onSkip,
    onNext: controls.onNext,
    expectedFromSquare: m.expectedFromSquare,
    expectedToSquare: m.expectedToSquare,
    solutionUci: m.solutionUci,
    solveIdx: m.solveIdx,
    movesStr: m.movesStr,
    hostIdentity: m.hostIdentity,
    isSpectator: createMemo(
      () => m.status() !== 'loading' && m.isPuzzleHost() === false
    ),
    clockElapsedMs: clock.elapsedMs,
    clockRunning: clock.running,
    recommendationEntries: recommendations.entries,
    recommendationArrows: recommendations.arrows,
    recommendationColorFor: recommendations.colorFor,
    onRecommendMove: recommend.onRecommendMove,
    onClearMyRecommendation: recommend.onClearMyRecommendation,
    recommendBump: recommend.recommendBump,
    spaceRole: args.spaceRole,
    recommendationProbe: args.recommendationProbe,
  };
}

export type PuzzlePlayerChromeModel = ReturnType<typeof frozenPlayerModel>;

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
        initialFen: m.initialFen(),
        displayFen: m.displayFen(),
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
  return ui;
}
