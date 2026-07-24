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
  | 'star'
  | 'crown'
  | 'dot';

export type CellFeedbackCorner =
  | 'topRight'
  | 'topLeft'
  | 'bottomLeft'
  | 'bottomRight'
  | 'center';

export type CellFeedback = {
  kind: CellFeedbackKind;
  /** Override default palette color (theme.feedback.<kind> by default). */
  color?: string;
  /** Pulse loop while present. */
  pulse?: boolean;
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
  lastMove: string;
  selected: string;
  legalMoveDot: string;
  legalMoveCaptureRing: string;
  check: string;
  coordinates: string;
  feedback: Record<CellFeedbackKind, string>;
  arrows: BoardArrowPalette;
  promotion: BoardPromotionPalette;
};

export type ChessBoardProps = {
  fen?: string;
  /**
   * When true, the board never applies moves locally: `fen` (and optional
   * `fenSyncKey`) are the only source of position. Validates plies on a copy,
   * then calls `onMove`; parent must update `fen` (or bump `fenSyncKey` with
   * the same FEN to discard a rejected attempt).
   */
  controlled?: boolean;
  /** Bumps to re-apply the current `fen` when the string is unchanged (e.g. wrong puzzle try). */
  fenSyncKey?: number;
  onMove?: (m: Move) => void;
  orientation?: BoardOrientation;
  size?: number;
  interactive?: boolean;
  showCoordinates?: boolean;
  highlightLastMove?: boolean;
  highlightLegalMoves?: boolean;
  theme?: Partial<BoardTheme>;
  testID?: string;

  /** Per-square feedback badges (checks, x marks, ?!, etc.). */
  cellFeedback?: Partial<Record<Square, CellFeedback>>;
  /** Per-square colored fill or ring on top of the square. */
  cellHighlights?: Partial<Record<Square, CellHighlight>>;
  /** Externally-driven arrows (engine hints, puzzle solution lines, etc.). */
  arrows?: readonly BoardArrow[];
  /** Right-click / two-finger draw arrows on board (lichess-style). Default false. */
  enableUserArrows?: boolean;
  /** Notified when user-drawn arrows change. */
  onUserArrowsChange?: (arrows: readonly BoardArrow[]) => void;
  /**
   * Piece slide between squares (plus capture ghost / capture SFX timing).
   * Default true — the essential board animation. Set false to snap instantly
   * when chasing performance on low-end devices.
   */
  animations?: boolean;
};

export type Position = readonly (Piece | null)[];
