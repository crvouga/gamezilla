import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared/move-history';
import { buildPuzzleMoveHistory } from '@libs/game-puzzle-shared/move-history';
import type { PuzzleNavIntent } from '@libs/game-puzzle-shared/puzzle-nav';
import {
  isPuzzleSeekAnimated,
  resolvePuzzleNavTarget,
} from '@libs/game-puzzle-shared/puzzle-nav';
import { positionAt, setupPuzzle } from '@libs/game-puzzle-shared/puzzle-setup';
import { lineActions, lineLength } from '@libs/game-puzzle-shared/step';
import { puzzleLineLayout } from '@pkgs/turn-game-shared/game-puzzles';
import type { GameSide } from '@pkgs/turn-game-shared/game-rules';
import type { Accessor } from 'solid-js';
import { createMemo, createSignal } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';

export type PuzzleReviewBoardModel = {
  readonly ready: Accessor<boolean>;
  readonly displayPosition: Accessor<string>;
  readonly orientation: Accessor<GameSide>;
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
  readonly solveIdx: Accessor<number | null>;
  readonly seek: (index: number) => void;
};

export function usePuzzleReviewBoard(
  fen: string,
  moves: string,
  cursor: PuzzleReviewCursor
): PuzzleReviewBoardModel {
  const { game } = usePuzzleGame();
  const firstSolveIdx = puzzleLineLayout(game.puzzles).start;
  const setup = createMemo(() => setupPuzzle(game, fen, lineActions(moves)));
  const tokensLength = createMemo(() => lineLength(moves));
  // The board snaps unless the seek that produced this position was one ply.
  const [animated, setAnimated] = createSignal(false);

  const solveIdx = createMemo(() => {
    const selected = cursor.solveIdx();
    return selected !== null &&
      selected >= firstSolveIdx &&
      selected <= tokensLength()
      ? selected
      : tokensLength();
  });

  const plies = createMemo(() =>
    buildPuzzleMoveHistory(game, {
      position: fen,
      moves,
      throughIdx: tokensLength(),
    })
  );

  const displayPosition = createMemo(() => {
    const atIdx = positionAt(game, fen, lineActions(moves), solveIdx());
    if (atIdx !== null) return atIdx;
    const s = setup();
    return s.kind === 'ready' ? s.displayPosition : '';
  });

  const orientation = createMemo<GameSide>(() => {
    const s = setup();
    return s.kind === 'ready' ? s.solverSide : 'white';
  });

  const ready = createMemo(
    () => setup().kind === 'ready' && displayPosition().length > 0
  );

  const canGoBack = createMemo(() => solveIdx() > firstSolveIdx);
  const canGoForward = createMemo(() => solveIdx() < tokensLength());

  const onSeek = (targetSolveIdx: number): void => {
    if (targetSolveIdx < firstSolveIdx) return;
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
      firstSolveIdx,
    });
    if (target === null) return;
    onSeek(target);
  };

  return {
    ready,
    displayPosition,
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
