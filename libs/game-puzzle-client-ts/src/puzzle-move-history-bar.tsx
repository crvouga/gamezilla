import { buildPuzzleMoveHistory } from '@libs/game-puzzle-shared-ts/move-history';
import {
  PUZZLE_PLAY_STATUS,
  PuzzlePlayAttr,
} from '@libs/game-puzzle-shared-ts/play-attr';
import { SeekPuzzlePlay } from '@libs/game-puzzle-shared-ts/play-messages';
import type { PuzzleNavIntent } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import {
  puzzleNavFromState,
  resolvePuzzleNavTarget,
} from '@libs/game-puzzle-shared-ts/puzzle-nav';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client-ts/use-space-room-selector';
import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import { createMemo, type JSX } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';
import { PuzzleMoveHistory } from './puzzle-move-history';
import { usePuzzleMoveWriting } from './use-puzzle-notation';

export function PuzzleMoveHistoryBar(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const { game } = usePuzzleGame();
  const firstSolveIdx = puzzleLineLayout(game.puzzles).start;
  const writing = usePuzzleMoveWriting();
  const fen = useSpaceRoomSelector(PuzzlePlayAttr.position.from);
  const moves = useSpaceRoomSelector(PuzzlePlayAttr.line.from);
  const solveIdx = useSpaceRoomSelector(PuzzlePlayAttr.solveIdx.from);
  const furthestSolveIdx = useSpaceRoomSelector(
    PuzzlePlayAttr.furthestSolveIdx.from
  );
  const status = useSpaceRoomSelector(PuzzlePlayAttr.status.from);

  const plies = createMemo(() =>
    buildPuzzleMoveHistory(game, {
      position: fen(),
      moves: moves(),
      throughIdx: furthestSolveIdx(),
    })
  );

  const interactive = createMemo(
    () =>
      status() === PUZZLE_PLAY_STATUS.solving ||
      status() === PUZZLE_PLAY_STATUS.solved ||
      status() === PUZZLE_PLAY_STATUS.revealed
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

  const onNavigate = (intent: PuzzleNavIntent): void => {
    const target = resolvePuzzleNavTarget({
      intent,
      solveIdx: solveIdx(),
      furthestSolveIdx: furthestSolveIdx(),
      firstSolveIdx,
    });
    if (target === null) return;
    onSeek(target);
  };

  return (
    <PuzzleMoveHistory
      plies={plies()}
      selectedSolveIdx={solveIdx()}
      interactive={interactive()}
      writing={writing}
      onSeek={onSeek}
      nav={{
        canGoBack: nav().canGoBack,
        canGoForward: nav().canGoForward,
        // Back / Forward already live in the bottom action bar here.
        showStepControls: false,
        onNavigate,
      }}
    />
  );
}
