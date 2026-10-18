import type { ChessPuzzleOrientation } from '@libs/chess-puzzle-shared/chess-puzzle-fsm';
import type { PuzzleHistoryPly } from '@libs/chess-puzzle-shared/chess-puzzle-move-history';
import { buildPuzzleMoveHistory } from '@libs/chess-puzzle-shared/chess-puzzle-move-history';
import { CHESS_PUZZLE_GAME } from '@libs/chess-puzzle-shared/chess-puzzles';
import type { PuzzleNavIntent } from '@libs/game-puzzle-shared/puzzle-nav';
import {
  isPuzzleSeekAnimated,
  PUZZLE_FIRST_SOLVE_IDX,
  resolvePuzzleNavTarget,
} from '@libs/game-puzzle-shared/puzzle-nav';
import { positionAt, setupPuzzle } from '@libs/game-puzzle-shared/puzzle-setup';
import { lineActions, lineLength } from '@libs/game-puzzle-shared/step';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo, createSignal } from 'solid-js';

export type PuzzleReviewBoardModel = {
  readonly ready: Accessor<boolean>;
  readonly displayFen: Accessor<string>;
  readonly orientation: Accessor<ChessPuzzleOrientation>;
  readonly plies: Accessor<readonly PuzzleHistoryPly[]>;
  readonly solveIdx: Accessor<number>;
  readonly lastSolveIdx: Accessor<number>;
  readonly canGoBack: Accessor<boolean>;
  readonly canGoForward: Accessor<boolean>;
  /** §7: single steps animate, jumps snap. */
  readonly animated: Accessor<boolean>;
  readonly onSeek: (solveIdx: number) => void;
  readonly onNavigate: (intent: PuzzleNavIntent) => void;
};

export type PuzzleReviewCursor = {
  readonly solveIdx: Accessor<number>;
  readonly seek: (index: number) => void;
};

export function usePuzzleReviewBoard(
  fen: string,
  moves: string,
  cursor: PuzzleReviewCursor
): PuzzleReviewBoardModel {
  const setup = createMemo(() =>
    setupPuzzle(CHESS_PUZZLE_GAME, fen, lineActions(moves))
  );
  const tokensLength = createMemo(() => lineLength(moves));
  // The board snaps unless the seek that produced this position was one ply.
  const [animated, setAnimated] = createSignal(false);

  createEffect(() => {
    if (tokensLength() <= 0) return;
    if (cursor.solveIdx() !== 0) return;
    cursor.seek(tokensLength());
  });

  const solveIdx = createMemo(() =>
    cursor.solveIdx() > 0 ? cursor.solveIdx() : tokensLength()
  );

  const plies = createMemo(() =>
    buildPuzzleMoveHistory({ fen, moves, throughIdx: tokensLength() })
  );

  const displayFen = createMemo(() => {
    const atIdx = positionAt(
      CHESS_PUZZLE_GAME,
      fen,
      lineActions(moves),
      solveIdx()
    );
    if (atIdx !== null) return atIdx;
    const s = setup();
    return s.kind === 'ready' ? s.displayPosition : '';
  });

  const orientation = createMemo<ChessPuzzleOrientation>(() => {
    const s = setup();
    return s.kind === 'ready' ? s.solverSide : 'white';
  });

  const ready = createMemo(
    () => setup().kind === 'ready' && displayFen().length > 0
  );

  const canGoBack = createMemo(() => solveIdx() > PUZZLE_FIRST_SOLVE_IDX);
  const canGoForward = createMemo(() => solveIdx() < tokensLength());

  const onSeek = (targetSolveIdx: number): void => {
    if (targetSolveIdx < PUZZLE_FIRST_SOLVE_IDX) return;
    if (targetSolveIdx > tokensLength()) return;
    const current = solveIdx();
    if (targetSolveIdx === current) return;
    setAnimated(isPuzzleSeekAnimated(current, targetSolveIdx));
    cursor.seek(targetSolveIdx);
  };

  const onNavigate = (intent: PuzzleNavIntent): void => {
    const target = resolvePuzzleNavTarget({
      intent,
      solveIdx: solveIdx(),
      furthestSolveIdx: tokensLength(),
    });
    if (target === null) return;
    onSeek(target);
  };

  return {
    ready,
    displayFen,
    orientation,
    plies,
    solveIdx,
    lastSolveIdx: tokensLength,
    canGoBack,
    canGoForward,
    animated,
    onSeek,
    onNavigate,
  };
}
