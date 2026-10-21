/**
 * Public prop contract for {@link ChessBoard}. The board embeds the rules
 * (chess.js via `ChessGame`): the parent passes a FEN, hears `onMove`, and
 * confirms by passing the next FEN (or rejects by bumping `fenSyncKey`).
 */

import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
  CellFeedback,
  CellHighlight,
  Move,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';

export type ChessBoardProps = {
  /**
   * Position FEN. When provided with optional `fenSyncKey`, re-syncs the local
   * rules instance on change. Moves still apply locally (optimistically) so
   * the piece moves at once; the parent confirms by updating `fen`, or
   * rejects by bumping `fenSyncKey` with the same FEN.
   */
  fen?: string | undefined;
  /** Bumps to re-apply the current `fen` when the string is unchanged. */
  fenSyncKey?: number | undefined;
  onMove?: ((m: Move) => void) | undefined;
  orientation?: BoardOrientation | undefined;
  /** Fixed width in px; omit to fill parent. Outside 196..16384 is a preview. */
  size?: number | undefined;
  interactive?: boolean | undefined;
  /** Parent-owned board audio (default on). Disabling cancels pending playback. */
  sound?: boolean | undefined;
  showCoordinates?: boolean | undefined;
  highlightLastMove?: boolean | undefined;
  highlightLegalMoves?: boolean | undefined;
  theme?: Partial<BoardTheme> | undefined;
  dataSet?: ComponentDataSet | undefined;
  cellFeedback?: Partial<Record<Square, CellFeedback>> | undefined;
  cellHighlights?: Partial<Record<Square, CellHighlight>> | undefined;
  arrows?: readonly BoardArrow[] | undefined;
  enableUserArrows?: boolean | undefined;
  onUserArrowsChange?: ((arrows: readonly BoardArrow[]) => void) | undefined;
  /**
   * Piece slides (default on). Always off under the OS / browser "reduce
   * motion" setting, whatever this says.
   */
  animations?: boolean | undefined;
  /** Slide duration in ms (default 150, chess.com's speed); 0 = snap. */
  animationDurationMs?: number | undefined;
  premoves?: boolean | undefined;
  autoPromoteQueen?: boolean | undefined;
};
