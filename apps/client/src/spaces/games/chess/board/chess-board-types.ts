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
};

export type BoardTheme = {
  lightSquare: string;
  darkSquare: string;
  border: string;
  lastMove: string;
  selected: string;
  legalMoveDot: string;
  check: string;
  coordinates: string;
};

export type ChessBoardProps = {
  fen?: string;
  onMove?: (m: Move) => void;
  orientation?: BoardOrientation;
  size?: number;
  interactive?: boolean;
  showCoordinates?: boolean;
  highlightLastMove?: boolean;
  highlightLegalMoves?: boolean;
  theme?: Partial<BoardTheme>;
  testID?: string;
};

export type Position = readonly (Piece | null)[];
