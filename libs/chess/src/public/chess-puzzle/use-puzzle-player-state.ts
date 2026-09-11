import { useMyId } from '@libs/auth/public/use-current-user';
import { useSpacePresence } from '@libs/spaces/public/room/use-space-presence';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import { RoomMetaAttr } from '@pkgs/room';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo } from 'solid-js';

import {
  decidePuzzleSessionStart,
  shouldReclaimPuzzleHost,
} from '../../shared/puzzle-session/session-start-policy';

import {
  ChessPuzzlePlayAttr,
  ReclaimChessPuzzlePlay,
  StartChessPuzzlePlay,
} from '../chess-puzzle-play';
import {
  useChessPuzzleAllInteractions,
  usePuzzleEntityAndInteractions,
} from './chess-puzzle-play-queries';
import { useChessPuzzleCompletion } from './use-chess-puzzle-completion';
import { useChessPuzzleInteractionRecorder } from './use-chess-puzzle-interaction-recorder';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';
import { usePuzzleSolver } from './use-chess-puzzle-solver';
import { usePuzzlePlayerControls } from './use-puzzle-player-controls';
import { usePuzzlePlayerVisual } from './use-puzzle-player-visual';

const DEFAULT_PLAYER_ELO = 1200;

function useReclaimStalePuzzleHost(): void {
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

function useStartPuzzleSessionOnMount(args: {
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

function usePuzzlePlayerModel(args: {
  puzzleId: Accessor<string>;
  playGeneration: Accessor<number>;
  readyGeneration: Accessor<number>;
  startNonce: Accessor<number>;
}) {
  const myId = useMyId();
  const profile = useChessPuzzleProfileRatings(myId);
  const playerElo = createMemo(() =>
    profile.profileRating > 0 ? profile.profileRating : DEFAULT_PLAYER_ELO
  );
  const entity = usePuzzleEntityAndInteractions(args.puzzleId);
  const fen = createMemo(() => entity.fen);
  const movesStr = createMemo(() => entity.movesStr);
  const rating = createMemo(() => entity.rating);
  const themes = createMemo(() => entity.themes);
  const interactions = createMemo(() => entity.interactions);
  useReclaimStalePuzzleHost();
  useStartPuzzleSessionOnMount({
    puzzleId: args.puzzleId,
    fen,
    movesStr,
    playGeneration: args.playGeneration,
    readyGeneration: args.readyGeneration,
    startNonce: args.startNonce,
  });
  const solver = usePuzzleSolver({ puzzleId: args.puzzleId });
  const recorder = useChessPuzzleInteractionRecorder({
    puzzleId: args.puzzleId,
    puzzleRating: rating,
    status: solver.status,
    solveIdx: solver.solveIdx,
    interactions,
  });

  return {
    puzzleId: args.puzzleId,
    rating,
    playerElo,
    themes,
    interactions,
    movesStr,
    displayFen: solver.displayFen,
    layoutKey: solver.layoutKey,
    status: solver.status,
    orientation: solver.orientation,
    onMoveRaw: solver.onMove,
    solveIdx: solver.solveIdx,
    furthestSolveIdx: solver.furthestSolveIdx,
    totalTokens: solver.totalTokens,
    wrongFromSquare: solver.wrongFromSquare,
    wrongToSquare: solver.wrongToSquare,
    expectedFromSquare: solver.expectedFromSquare,
    expectedToSquare: solver.expectedToSquare,
    solutionUci: solver.solutionUci,
    solutionRevealed: solver.solutionRevealed,
    opponentAnimating: solver.opponentAnimating,
    appendUsedHint: recorder.appendUsedHint,
    appendAbandoned: recorder.appendAbandoned,
    setLastUci: recorder.setLastUci,
  };
}

function usePuzzlePlayerUi(args: {
  puzzleId: Accessor<string>;
  onRequestNext: () => void;
  m: ReturnType<typeof usePuzzlePlayerModel>;
}) {
  const allInteractions = useChessPuzzleAllInteractions();
  const completion = useChessPuzzleCompletion({
    puzzleId: args.m.puzzleId,
    interactions: args.m.interactions,
    allInteractions,
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
    appendAbandoned: args.m.appendAbandoned,
    onRequestNext: args.onRequestNext,
  });
  const visual = usePuzzlePlayerVisual({
    puzzleId: args.m.puzzleId,
    status: args.m.status,
    solveIdx: args.m.solveIdx,
    themes: args.m.themes,
    layoutKey: args.m.layoutKey,
    orientation: args.m.orientation,
    displayFen: args.m.displayFen,
    totalTokens: args.m.totalTokens,
    wrongFromSquare: args.m.wrongFromSquare,
    wrongToSquare: args.m.wrongToSquare,
    expectedFromSquare: args.m.expectedFromSquare,
    expectedToSquare: args.m.expectedToSquare,
    hintStage: controls.hintStage,
    atFrontier: controls.atFrontier,
    rating: args.m.rating,
  });

  return frozenPlayerModel({
    m: args.m,
    controls,
    visual,
    completion,
    puzzleId: args.m.puzzleId,
  });
}

function frozenPlayerModel(args: {
  m: ReturnType<typeof usePuzzlePlayerModel>;
  controls: ReturnType<typeof usePuzzlePlayerControls>;
  visual: ReturnType<typeof usePuzzlePlayerVisual>;
  completion: ReturnType<typeof useChessPuzzleCompletion>;
  puzzleId: Accessor<string>;
}) {
  const { m, controls, visual, completion } = args;
  return {
    puzzleId: m.puzzleId,
    rating: m.rating,
    playerElo: m.playerElo,
    completion,
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
    onNext: controls.onNext,
    expectedFromSquare: m.expectedFromSquare,
    expectedToSquare: m.expectedToSquare,
    solutionUci: m.solutionUci,
    solveIdx: m.solveIdx,
    movesStr: m.movesStr,
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
  return usePuzzlePlayerUi({
    puzzleId: args.puzzleId,
    onRequestNext: args.onRequestNext,
    m,
  });
}
