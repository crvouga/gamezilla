import { readCustomGameBoardProbe } from '@libs/chess-custom-game-harness/custom-game-play-reads';
import { readPuzzleBoardProbe } from '@libs/chess-puzzle-harness/chess-puzzle-solve-ui';
import type { ProductHarness } from '@libs/harness/harness';
import type { ChessBoardProbe } from '@pkgs/chess-board-core-shared/probe';

/**
 * The chess board on the person's screen, as painted: a Custom Game's board
 * while one is shown, otherwise the puzzle board, or `null` with no board.
 */
export async function readShownChessBoard(
  s: ProductHarness,
  actor: string
): Promise<ChessBoardProbe | null> {
  return (
    (await readCustomGameBoardProbe(s, actor)) ??
    (await readPuzzleBoardProbe(s, actor))
  );
}

/** The promotion the shown board asks about, or `null` when none waits. */
export async function readShownChessPromotion(
  s: ProductHarness,
  actor: string
): Promise<ChessBoardProbe['promotion']> {
  return (await readShownChessBoard(s, actor))?.promotion ?? null;
}
