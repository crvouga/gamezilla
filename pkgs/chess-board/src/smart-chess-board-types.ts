/**
 * Public prop contract for the Solid {@link SmartChessBoard} adapter (owns
 * chess.js via {@link ChessGame}). Controlled view props live in
 * `chess-board-types.ts`.
 */

import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
  CellFeedback,
  CellHighlight,
  Move,
  Square,
} from '@pkgs/chess-board-core/types';
import type { ComponentDataSet } from '@pkgs/ui';

export type {
  BoardArrow,
  BoardArrowPalette,
  BoardOrientation,
  BoardPromotionPalette,
  BoardTheme,
  CellFeedback,
  CellFeedbackCorner,
  CellFeedbackKind,
  CellHighlight,
  FileChar,
  Move,
  Piece,
  PieceCode,
  PieceColor,
  PieceType,
  Position,
  RankChar,
  Square,
} from '@pkgs/chess-board-core/types';

export type SmartChessBoardProps = {
  /**
   * Position FEN. When provided with optional `fenSyncKey`, re-syncs the local
   * rules instance on change. Moves still apply locally (optimistically) so
   * the piece slides at once; the parent confirms by updating `fen`, or
   * rejects by bumping `fenSyncKey` with the same FEN.
   */
  fen?: string | undefined;
  /** Bumps to re-apply the current `fen` when the string is unchanged. */
  fenSyncKey?: number | undefined;
  onMove?: ((m: Move) => void) | undefined;
  orientation?: BoardOrientation | undefined;
  /** Fixed side in px. Omit to fill the parent width (square via `aspect-ratio`). */
  size?: number | undefined;
  interactive?: boolean | undefined;
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
  animations?: boolean | undefined;
  premoves?: boolean | undefined;
  autoPromoteQueen?: boolean | undefined;
};
