/**
 * Public prop contract for the Solid {@link ChessBoard}. Board model types
 * (squares, pieces, moves, annotations, theme) live in `@pkgs/chess-board-core`
 * and are re-exported here so consumers import one module.
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

export type ChessBoardProps = {
  /**
   * Position FEN. When provided with optional `fenSyncKey`, re-syncs the local
   * rules instance on change. Moves still apply locally (optimistically) so
   * the piece slides at once; the parent confirms by updating `fen`, or
   * rejects by bumping `fenSyncKey` with the same FEN.
   */
  fen?: string | undefined;
  /** Bumps to re-apply the current `fen` when the string is unchanged (e.g. wrong puzzle try). */
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
  /**
   * DOM `data-*` identifiers. `testid` doubles as the board id that the
   * probe / square ids derive from (`DEFAULT_CHESS_BOARD_TEST_ID` otherwise).
   */
  dataSet?: ComponentDataSet | undefined;

  /** Per-square feedback badges (checks, x marks, ?!, etc.). */
  cellFeedback?: Partial<Record<Square, CellFeedback>> | undefined;
  /** Per-square colored fill or ring on top of the square. */
  cellHighlights?: Partial<Record<Square, CellHighlight>> | undefined;
  /** Externally-driven arrows (engine hints, puzzle solution lines, etc.). */
  arrows?: readonly BoardArrow[] | undefined;
  /** Right-click + drag draws arrows on the board (lichess-style). Default false. */
  enableUserArrows?: boolean | undefined;
  /** Notified when user-drawn arrows change. */
  onUserArrowsChange?: ((arrows: readonly BoardArrow[]) => void) | undefined;
  /**
   * Piece slide between squares (plus capture ghost / capture SFX timing).
   * Default true. `prefers-reduced-motion` disables the slide regardless.
   */
  animations?: boolean | undefined;
  /**
   * Queue one move while the opponent is to move; applied when it becomes
   * your turn (if still legal). Default false.
   */
  premoves?: boolean | undefined;
  /** Skip the promotion picker and promote to queen. Default false. */
  autoPromoteQueen?: boolean | undefined;
};
