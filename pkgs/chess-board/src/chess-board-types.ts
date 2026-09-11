/**
 * Controlled (view-only) prop contract for {@link ChessBoard}. Legal dests and
 * position come from the parent; the board emits intents and does not own
 * chess.js. Prefer {@link SmartChessBoard} when you want an embedded rules
 * adapter.
 */

import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
  CellFeedback,
  CellHighlight,
  Move,
  PieceColor,
  Position,
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

export type ChessBoardMovable = {
  /** Side that may move; omit / null = none. `'both'` for free play / editor. */
  readonly color?: PieceColor | 'both' | null;
  /** Legal destinations keyed by origin square. */
  readonly dests: ReadonlyMap<Square, readonly Square[]>;
};

export type ChessBoardAnimationConfig = {
  readonly enabled?: boolean;
  /** Slide duration in ms. Default 150. */
  readonly durationMs?: number;
};

export type ChessBoardProps = {
  /** Flat 64-square position (index 0 = a1). Preferred over `fen`. */
  position?: Position | undefined;
  /** Display FEN when `position` is omitted (parsed for paint only). */
  fen?: string | undefined;
  orientation?: BoardOrientation | undefined;
  turnColor?: PieceColor | undefined;
  movable?: ChessBoardMovable | undefined;
  lastMove?: Move | null | undefined;
  check?: Square | null | undefined;
  viewOnly?: boolean | undefined;
  size?: number | undefined;
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
  animation?: ChessBoardAnimationConfig | boolean | undefined;
  premoves?: boolean | undefined;
  autoPromoteQueen?: boolean | undefined;
  onMove?: ((m: Move) => void) | undefined;
  onSelect?: ((square: Square | null) => void) | undefined;
  onPremove?: ((m: Move) => void) | undefined;
  onPremoveCancel?: (() => void) | undefined;
};
