/**
 * Framework-free chess board model: squares, pieces, moves, annotations and
 * theme tokens. Rendering packages (SVG / canvas) build on these types.
 */

export type FileChar = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type RankChar = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${FileChar}${RankChar}`;

export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type Piece = {
  color: PieceColor;
  type: PieceType;
};

export type PieceCode =
  | 'wp'
  | 'wn'
  | 'wb'
  | 'wr'
  | 'wq'
  | 'wk'
  | 'bp'
  | 'bn'
  | 'bb'
  | 'br'
  | 'bq'
  | 'bk';

export type BoardOrientation = 'white' | 'black';

export type Move = {
  from: Square;
  to: Square;
  promotion?: Exclude<PieceType, 'p' | 'k'>;
  san?: string;
  captured?: PieceType;
  /** Kingside (k) or queenside (q) castle: rook leg for animation. */
  castle?: { rookFrom: Square; rookTo: Square };
  /** Pawn captured on the square behind the destination (not on `to`). */
  enPassant?: true;
};

export type CellFeedbackKind =
  | 'check'
  | 'cross'
  | 'exclamation'
  | 'doubleExclam'
  | 'question'
  | 'questionExclam'
  | 'dot';

export type CellFeedbackCorner =
  | 'topRight'
  | 'topLeft'
  | 'bottomLeft'
  | 'bottomRight'
  | 'center';

export type CellFeedback = {
  kind: CellFeedbackKind;
  /** Activity-supplied annotation text, replacing the kind's usual glyph. */
  label?: string;
  /** Override default palette color (theme.feedback.<kind> by default). */
  color?: string;
  /** 0..1, default 1. */
  opacity?: number;
  /** Default `'topRight'`. */
  corner?: CellFeedbackCorner;
};

export type BoardArrow = {
  from: Square;
  to: Square;
  /** Theme key or raw color. Default: theme.arrows.primary. */
  color?: string;
  /** Stroke width as fraction of cell. Default ~0.14. */
  thickness?: number;
  /** 0..1, default 0.85. */
  opacity?: number;
  /** Dashed shaft (e.g. plan lines vs forced lines). */
  dashed?: boolean;
  /** Render an L-shape (knight). Auto-detected if absent and from→to is a knight jump. */
  knight?: boolean;
  /** Stable id for keying / deduping. */
  id?: string;
};

export type CellHighlight = {
  /** Solid tint or theme key. */
  color: string;
  /** 0..1, default 0.35. */
  opacity?: number;
  /** Border ring instead of fill. */
  ring?: boolean;
};

export type BoardArrowPalette = {
  primary: string;
  secondary: string;
  alt: string;
  danger: string;
  muted: string;
};

export type BoardPromotionPalette = {
  backdrop: string;
  surface: string;
  surfaceActive: string;
  cancel: string;
  /** Cancel-chip icon / ink — must contrast with {@link cancel}. */
  ink: string;
};

export type BoardTheme = {
  lightSquare: string;
  darkSquare: string;
  border: string;
  /** Translucent wash over the last move's from / to squares. */
  lastMove: string;
  /** Translucent wash over the selected / dragged piece's square. */
  selected: string;
  /** Translucent wash over every queued premove's from / to squares. */
  premove: string;
  /** Inset ring on the square under a dragged piece. */
  hover: string;
  legalMoveDot: string;
  legalMoveCaptureRing: string;
  /** Radial glow under a king in check. */
  check: string;
  feedback: Record<CellFeedbackKind, string>;
  arrows: BoardArrowPalette;
  promotion: BoardPromotionPalette;
};

export type Position = readonly (Piece | null)[];
