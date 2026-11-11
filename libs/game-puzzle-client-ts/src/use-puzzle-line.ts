import { buildPuzzleMoveHistory } from '@libs/game-puzzle-shared-ts/move-history';
import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
} from '@libs/game-puzzle-shared-ts/play-attr';
import {
  SeekPuzzlePlay,
  StepBackPuzzlePlay,
  StepForwardPuzzlePlay,
} from '@libs/game-puzzle-shared-ts/play-messages';
import {
  PUZZLE_NAV_INTENT,
  type PuzzleNavIntent,
  puzzleNavFromState,
  resolvePuzzleNavTarget,
} from '@libs/game-puzzle-shared-ts/puzzle-nav';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client-ts/use-space-room-selector';
import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';
import type { PuzzleLineModel } from './puzzle-play-screen-model';
import { usePuzzleMoveWriting } from './use-puzzle-notation';

/**
 * The room's line as the board's screens show it: the moves reached, the
 * one the board is on, and stepping, jumping and choosing among them (the
 * room's own commands, so everyone watching follows). `toLive` returns the
 * board to the latest move.
 */
export function usePuzzleLine(): {
  readonly model: Accessor<PuzzleLineModel>;
  readonly toLive: () => void;
} {
  const dispatch = useSpaceRoomDispatch();
  const { game } = usePuzzleGame();
  const firstSolveIdx = puzzleLineLayout(game.puzzles).start;
  const writing = usePuzzleMoveWriting();
  const position = useSpaceRoomSelector(PuzzlePlayAttr.position.from);
  const moves = useSpaceRoomSelector(PuzzlePlayAttr.line.from);
  const solveIdx = useSpaceRoomSelector(PuzzlePlayAttr.solveIdx.from);
  const furthestSolveIdx = useSpaceRoomSelector(
    PuzzlePlayAttr.furthestSolveIdx.from
  );
  const status = useSpaceRoomSelector(PuzzlePlayAttr.status.from);
  const plies = createMemo(() =>
    buildPuzzleMoveHistory(game, {
      position: position(),
      moves: moves(),
      throughIdx: furthestSolveIdx(),
    })
  );
  const nav = createMemo(() =>
    puzzleNavFromState({
      status: status(),
      solveIdx: solveIdx(),
      furthestSolveIdx: furthestSolveIdx(),
      firstSolveIdx,
      moves: moves(),
    })
  );
  const onSeek = (targetSolveIdx: number): void => {
    dispatch(SeekPuzzlePlay({ solveIdx: targetSolveIdx }));
  };
  // A step is the room's own step command; a jump seeks its end of the line.
  const onNavigate = (intent: PuzzleNavIntent): void => {
    if (intent === PUZZLE_NAV_INTENT.back) {
      if (nav().canGoBack) dispatch(StepBackPuzzlePlay({}));
      return;
    }
    if (intent === PUZZLE_NAV_INTENT.forward) {
      if (nav().canGoForward) dispatch(StepForwardPuzzlePlay({}));
      return;
    }
    const target = resolvePuzzleNavTarget({
      intent,
      solveIdx: solveIdx(),
      furthestSolveIdx: furthestSolveIdx(),
      firstSolveIdx,
    });
    if (target !== null) onSeek(target);
  };
  const model = createMemo<PuzzleLineModel>(() => ({
    plies: plies(),
    selectedSolveIdx: solveIdx(),
    interactive:
      status() === PUZZLE_PLAY_STATUS.solving ||
      status() === PUZZLE_PLAY_STATUS.solved ||
      status() === PUZZLE_PLAY_STATUS.revealed,
    awaiting:
      status() === PUZZLE_PLAY_STATUS.solving &&
      solveIdx() === furthestSolveIdx(),
    writing,
    nav: {
      canGoBack: nav().canGoBack,
      canGoForward: nav().canGoForward,
      onNavigate,
    },
    onSeek,
  }));
  return {
    model,
    toLive: () => {
      if (nav().canGoForward) onNavigate(PUZZLE_NAV_INTENT.end);
    },
  };
}
