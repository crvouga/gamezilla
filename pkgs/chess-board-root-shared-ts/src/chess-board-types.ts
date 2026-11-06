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
  /** Visible side, check and keyboard guidance beside a full playing board. */
  showGuidance?: boolean | undefined;
  /** Fit guidance and coordinates inside a square host, rather than adding height. */
  fitSquare?: boolean | undefined;
  /**
   * Coordinate placement: `inside` (default) uses square corners;
   * `outside-start` / `outside-end` adds the responsive frame with ranks
   * on that edge and files below. Thumbnails retain corner labels.
   * The outside frame is shown only when `showCoordinates` is enabled.
   */
  coordinatePlacement?: 'inside' | 'outside-start' | 'outside-end' | undefined;
  highlightLastMove?: boolean | undefined;
  /**
   * The move that reached `fen`, when the parent knows it and the board
   * cannot (a game opened part-way through, an earlier position reviewed).
   * Marked while the board shows that position and has no move of its own;
   * a move played or inferred on the board takes its place.
   */
  lastMove?: { readonly from: Square; readonly to: Square } | null | undefined;
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
