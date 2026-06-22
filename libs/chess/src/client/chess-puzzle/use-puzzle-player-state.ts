import { useEffect, useMemo } from 'react';
import { useCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useMyId } from '@libs/auth/client/use-current-user';
import { useSessionToken } from '@libs/auth/client/use-session-token';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/client/room/use-space-room-selector';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  StartChessPuzzlePlay,
} from '../../shared/chess-puzzle-play';
import { useChessPuzzleInteractionRecorder } from './use-chess-puzzle-interaction-recorder';
import { usePuzzleEntityAndInteractions, useChessPuzzleAllInteractions } from './chess-puzzle-play-queries';
import { useChessPuzzleCompletion } from './use-chess-puzzle-completion';
import { usePuzzleSolver } from './use-chess-puzzle-solver';
import { usePuzzlePlayerControls } from './use-puzzle-player-controls';
import { usePuzzlePlayerVisual } from './use-puzzle-player-visual';
import { useChessPuzzleProfileRatings } from './use-chess-puzzle-profile-ratings';

const DEFAULT_PLAYER_ELO = 1200;

function usePuzzleSessionIdentityReady(): boolean {
  const token = useSessionToken();
  const accountId = useCurrentAccountId();
  return token === null || accountId !== null;
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
}): void {
  const { puzzleId, fen, movesStr, playGeneration, readyGeneration } = args;
  const dispatch = useSpaceRoomDispatch();
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
  const identityReady = usePuzzleSessionIdentityReady();
  useEffect(() => {
    if (!identityReady) return;
    if (playGeneration !== readyGeneration) return;
    if (roomStatus !== CHESS_PUZZLE_PLAY_STATUS.idle) return;
    if (fen.length === 0 || movesStr.length === 0) return;
    if (roomPuzzleId !== null) return;
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
  ]);
}

function usePuzzlePlayerModel(
  puzzleId: string,
  playGeneration: number,
  readyGeneration: number
) {
  const myId = useMyId();
  const { profileRating, profileRd } = useChessPuzzleProfileRatings(myId);
  const playerElo = profileRating > 0 ? profileRating : DEFAULT_PLAYER_ELO;
  const { fen, movesStr, rating, themes, interactions } =
    usePuzzleEntityAndInteractions(puzzleId);
  useStartPuzzleSessionOnMount({
    puzzleId,
    fen,
    movesStr,
    playGeneration,
    readyGeneration,
  });
  const {
    displayFen,
    layoutKey,
    status,
    orientation,
    onMove: onMoveRaw,
    solveIdx,
    totalTokens,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    expectedToSquare,
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
    displayFen,
    layoutKey,
    status,
    orientation,
    onMoveRaw,
    solveIdx,
    totalTokens,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    expectedToSquare,
    appendUsedHint,
    appendAbandoned,
    setLastUci,
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
    // `null` (not '') so the screen can gate the ChessBoard render
    // until a real FEN is available; passing an empty string would let
    // `useChessGame` initialise with the standard startpos, flashing
    // the wrong board for a frame on puzzle transitions.
    displayFen: m.displayFen,
    layoutKey: m.layoutKey,
    orientation: m.orientation,
    status: m.status,
    hintStage: controls.hintStage,
    onMove: controls.onMove,
    cellFeedback: visual.cellFeedback,
    arrows: visual.arrows,
    onHint: controls.onHint,
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
    solveIdx: m.solveIdx,
    status: m.status,
    displayFen: m.displayFen,
    expectedFromSquare: m.expectedFromSquare,
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
    hintStage: controls.hintStage,
    rating: m.rating,
  });
  // Freeze the player's exposed shape every render so memoized children
  // (`PuzzleBoardSlot`, eventually `ChessPuzzleActionBar`) skip identical
  // prop bags. All callers go through this single object — no spread.
  return useMemo(
    () => frozenPlayerModel({ m, controls, visual, completion }),
    [m, controls, visual, completion]
  );
}

export function usePuzzlePlayerState(args: {
  puzzleId: string;
  playGeneration: number;
  readyGeneration: number;
  onRequestNext: () => void;
}) {
  const m = usePuzzlePlayerModel(
    args.puzzleId,
    args.playGeneration,
    args.readyGeneration
  );
  return usePuzzlePlayerUi(args.puzzleId, args.onRequestNext, m);
}

export type PuzzlePlayerChromeModel = ReturnType<typeof usePuzzlePlayerState>;
