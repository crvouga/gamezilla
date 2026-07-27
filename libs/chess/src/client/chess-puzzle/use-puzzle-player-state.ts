import { useEffect, useMemo, useRef } from 'react';
import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useMyId } from '@libs/auth/client/use-current-user';
import { useFreshAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/client/room/use-space-room-selector';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  ReclaimChessPuzzlePlay,
  StartChessPuzzlePlay,
} from '../../shared/chess-puzzle-play';
import { useChessPuzzleInteractionRecorder } from './use-chess-puzzle-interaction-recorder';
import {
  usePuzzleEntityAndInteractions,
  useChessPuzzleAllInteractions,
} from './chess-puzzle-play-queries';
import { useChessPuzzleCompletion } from './use-chess-puzzle-completion';
import { usePuzzleSolver } from './use-chess-puzzle-solver';
import { usePuzzlePlayerControls } from './use-puzzle-player-controls';
import { usePuzzlePlayerVisual } from './use-puzzle-player-visual';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

const DEFAULT_PLAYER_ELO = 1200;

function usePuzzleSessionIdentityReady(): boolean {
  const token = useFreshAuthToken();
  const accountId = useCurrentAccountId();
  return token === null || accountId !== null;
}

/**
 * When puzzle play was resumed from persisted room state, the recorded
 * `hostIdentity` may not match this member id. Reclaim transfers host to the
 * current actor so moves and hints authorize again. Same user on another
 * device does not reclaim (member ids match).
 */
function useReclaimStalePuzzleHost(): void {
  const memberId = useMyId();
  const dispatch = useSpaceRoomDispatch();
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const hostIdentity = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.hostIdentity.from
  );
  useEffect(() => {
    if (memberId.length === 0) return;
    if (roomStatus === CHESS_PUZZLE_PLAY_STATUS.idle) return;
    if (hostIdentity === null || hostIdentity === memberId) return;
    dispatch(ReclaimChessPuzzlePlay({}));
  }, [dispatch, hostIdentity, memberId, roomStatus]);
}

/**
 * Dispatches `StartChessPuzzlePlay` once the room is idle for `puzzleId`
 * and the entity data has been hydrated. Lives inside the player (not the
 * screen) so the screen never needs its own duplicate `usePuzzleEntity`
 * subscription — the player already owns one via
 * {@link usePuzzleEntityAndInteractions}.
 */
function useStartPuzzleSessionOnMount(args: {
  puzzleId: string;
  fen: string;
  movesStr: string;
  /** Bumps on every "Next" press so we re-dispatch Start even when `puzzleId` is unchanged. */
  playGeneration: number;
  /** Screen bumps this after puzzle-id swap lands so Start never races ahead of the parent. */
  readyGeneration: number;
  /**
   * Only Start when the screen arms a new placement. Prevents Clear→idle from
   * re-Starting the previous puzzle on every connected client.
   */
  startNonce: number;
}): void {
  const {
    puzzleId,
    fen,
    movesStr,
    playGeneration,
    readyGeneration,
    startNonce,
  } = args;
  const dispatch = useSpaceRoomDispatch();
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
  const identityReady = usePuzzleSessionIdentityReady();
  const lastStartedNonceRef = useRef(0);
  useEffect(() => {
    if (!identityReady) return;
    if (startNonce === 0) return;
    if (startNonce === lastStartedNonceRef.current) return;
    if (playGeneration !== readyGeneration) return;
    if (roomStatus !== CHESS_PUZZLE_PLAY_STATUS.idle) {
      if (roomPuzzleId !== null) {
        lastStartedNonceRef.current = startNonce;
      }
      return;
    }
    if (fen.length === 0 || movesStr.length === 0) return;
    if (roomPuzzleId !== null) {
      lastStartedNonceRef.current = startNonce;
      return;
    }
    lastStartedNonceRef.current = startNonce;
    dispatch(StartChessPuzzlePlay({ puzzleId, fen, moves: movesStr }));
  }, [
    dispatch,
    fen,
    movesStr,
    playGeneration,
    readyGeneration,
    puzzleId,
    roomPuzzleId,
    roomStatus,
    identityReady,
    startNonce,
  ]);
}

function usePuzzlePlayerModel(
  puzzleId: string,
  playGeneration: number,
  readyGeneration: number,
  startNonce: number
) {
  const myId = useMyId();
  const { profileRating, profileRd } = useChessPuzzleProfileRatings(myId);
  const playerElo = profileRating > 0 ? profileRating : DEFAULT_PLAYER_ELO;
  const { fen, movesStr, rating, themes, interactions } =
    usePuzzleEntityAndInteractions(puzzleId);
  useReclaimStalePuzzleHost();
  useStartPuzzleSessionOnMount({
    puzzleId,
    fen,
    movesStr,
    playGeneration,
    readyGeneration,
    startNonce,
  });
  const {
    displayFen,
    layoutKey,
    status,
    orientation,
    onMove: onMoveRaw,
    solveIdx,
    furthestSolveIdx,
    totalTokens,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    expectedToSquare,
    solutionRevealed,
    opponentAnimating,
  } = usePuzzleSolver({ puzzleId });
  const { appendUsedHint, appendAbandoned, setLastUci } =
    useChessPuzzleInteractionRecorder({
      puzzleId,
      puzzleRating: rating,
      status,
      solveIdx,
      interactions,
    });
  return {
    rating,
    playerElo,
    profileRd,
    themes,
    interactions,
    movesStr,
    displayFen,
    layoutKey,
    status,
    orientation,
    onMoveRaw,
    solveIdx,
    furthestSolveIdx,
    totalTokens,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    expectedToSquare,
    appendUsedHint,
    appendAbandoned,
    setLastUci,
    opponentAnimating,
    solutionRevealed,
  };
}

type PlayerControls = ReturnType<typeof usePuzzlePlayerControls>;
type PlayerVisual = ReturnType<typeof usePuzzlePlayerVisual>;

function frozenPlayerModel(args: {
  m: ReturnType<typeof usePuzzlePlayerModel>;
  controls: PlayerControls;
  visual: PlayerVisual;
  completion: ReturnType<typeof useChessPuzzleCompletion>;
}) {
  const { m, controls, visual, completion } = args;
  return {
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
  };
}

function usePuzzlePlayerUi(
  puzzleId: string,
  onRequestNext: () => void,
  m: ReturnType<typeof usePuzzlePlayerModel>
) {
  const allInteractions = useChessPuzzleAllInteractions();
  const completion = useChessPuzzleCompletion({
    puzzleId,
    interactions: m.interactions,
    allInteractions,
    status: m.status,
  });
  const controls = usePuzzlePlayerControls({
    puzzleId,
    moves: m.movesStr,
    solveIdx: m.solveIdx,
    furthestSolveIdx: m.furthestSolveIdx,
    status: m.status,
    displayFen: m.displayFen,
    expectedFromSquare: m.expectedFromSquare,
    expectedToSquare: m.expectedToSquare,
    solutionRevealed: m.solutionRevealed,
    onMoveRaw: m.onMoveRaw,
    setLastUci: m.setLastUci,
    appendUsedHint: m.appendUsedHint,
    appendAbandoned: m.appendAbandoned,
    onRequestNext,
  });
  const visual = usePuzzlePlayerVisual({
    puzzleId,
    status: m.status,
    solveIdx: m.solveIdx,
    themes: m.themes,
    layoutKey: m.layoutKey,
    orientation: m.orientation,
    showCorrectFlash: controls.showCorrectFlash,
    displayFen: m.displayFen,
    totalTokens: m.totalTokens,
    wrongFromSquare: m.wrongFromSquare,
    wrongToSquare: m.wrongToSquare,
    expectedFromSquare: m.expectedFromSquare,
    expectedToSquare: m.expectedToSquare,
    solvedCrownSquare: controls.solvedCrownSquare,
    lastCorrectToSquare: controls.lastCorrectToSquare,
    hintStage: controls.hintStage,
    atFrontier: controls.atFrontier,
    rating: m.rating,
  });
  return useMemo(
    () => frozenPlayerModel({ m, controls, visual, completion }),
    [m, controls, visual, completion]
  );
}

export function usePuzzlePlayerState(args: {
  puzzleId: string;
  playGeneration: number;
  readyGeneration: number;
  startNonce: number;
  onRequestNext: () => void;
}) {
  const m = usePuzzlePlayerModel(
    args.puzzleId,
    args.playGeneration,
    args.readyGeneration,
    args.startNonce
  );
  return usePuzzlePlayerUi(args.puzzleId, args.onRequestNext, m);
}

export type PuzzlePlayerChromeModel = ReturnType<typeof usePuzzlePlayerState>;
