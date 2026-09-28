import { Chess } from 'chess.js';

import { squareCenter, squareFromIndex } from './geometry';
import { pieceCode } from './piece-code';
import { positionFromChess } from './position';
import type {
  BoardOrientation,
  Move,
  PieceCode,
  PieceColor,
  Square,
} from './types';

/** Default outer `testID` when ChessBoard is mounted without one. */
export const DEFAULT_CHESS_BOARD_TEST_ID = 'chess-board';

export function chessBoardProbeTestId(boardTestId: string): string {
  return `${boardTestId}-probe`;
}

/** Per-square button id (`<board>-square-e4`). */
export function chessBoardSquareTestId(
  boardTestId: string,
  square: Square
): string {
  return `${boardTestId}-square-${square}`;
}

export type ChessBoardPromotionChoice =
  | NonNullable<Move['promotion']>
  | 'cancel';

/** Promotion picker button id (`<board>-promotion-q`, `…-promotion-cancel`). */
export function chessBoardPromotionTestId(
  boardTestId: string,
  choice: ChessBoardPromotionChoice
): string {
  return `${boardTestId}-promotion-${choice}`;
}

/** ARIA live region that speaks the last move. */
export function chessBoardLiveRegionTestId(boardTestId: string): string {
  return `${boardTestId}-live`;
}

/** Painted layers, each readable as a list of {@link ChessBoardPaint} tokens. */
export type ChessBoardLayer =
  | 'squares'
  | 'pieces'
  | 'shapes'
  | 'arrows'
  | 'feedback';

export const CHESS_BOARD_LAYERS: readonly ChessBoardLayer[] = [
  'squares',
  'pieces',
  'shapes',
  'arrows',
  'feedback',
];

export function chessBoardLayerTestId(
  boardTestId: string,
  layer: ChessBoardLayer
): string {
  return `${boardTestId}-layer-${layer}`;
}

/**
 * What a painted node shows, in test builds only: each node carries an
 * unpainted text token so a driver reads the painted board as text.
 */
export type ChessBoardPaintKind =
  | 'piece'
  | 'capture-ghost'
  | 'premove-ghost'
  | 'selected'
  | 'check'
  | 'premove'
  | 'last-move'
  | 'highlight'
  | 'dot'
  | 'ring'
  | 'circle'
  | 'arrow'
  | 'arrow-preview'
  | 'feedback';

/** A single painted node, e.g. `piece:wp@e4`, `dot@e4`, `arrow:primary@e2-e4`. */
export type ChessBoardPaint = string;

const PAINT_OPEN = '⟦';
const PAINT_CLOSE = '⟧';
const PAINT_PATTERN = /⟦([^⟦⟧]+)⟧/g;

/** Token text for a painted node: `⟦kind[:detail]@where⟧`. */
export function chessBoardPaintToken(args: {
  readonly kind: ChessBoardPaintKind;
  readonly at: string;
  readonly detail?: string | undefined;
}): string {
  const head =
    args.detail === undefined ? args.kind : `${args.kind}:${args.detail}`;
  return `${PAINT_OPEN}${head}@${args.at}${PAINT_CLOSE}`;
}

/** Sorted paint tokens (without delimiters) found in a layer's text. */
export function parseChessBoardPaint(
  text: string | null
): readonly ChessBoardPaint[] {
  const out: ChessBoardPaint[] = [];
  for (const match of (text ?? '').matchAll(PAINT_PATTERN)) {
    const token = match[1];
    if (token !== undefined) out.push(token);
  }
  return out.sort();
}

export type ChessBoardProbePiece = {
  readonly square: Square;
  readonly piece: PieceCode;
  /** Board-local pixel center X. */
  readonly x: number;
  /** Board-local pixel center Y. */
  readonly y: number;
};

export type ChessBoardProbeStatus =
  | 'playing'
  | 'checkmate'
  | 'stalemate'
  | 'draw';

export type ChessBoardProbeMove = {
  readonly from: Square;
  readonly to: Square;
};

/** Interaction state the board model holds (not derivable from the FEN). */
export type ChessBoardProbeInteraction = {
  readonly interactive: boolean;
  readonly selected: Square | null;
  /** Sorted legal destinations of the selection. */
  readonly legalTargets: readonly Square[];
  readonly lastMove: ChessBoardProbeMove | null;
  readonly promotion:
    | (ChessBoardProbeMove & { readonly color: PieceColor })
    | null;
  readonly premoves: readonly ChessBoardProbeMove[];
  /** Keyboard cursor (the focusable square). */
  readonly cursor: Square;
};

export type ChessBoardProbe = ChessBoardProbeInteraction & {
  readonly size: number;
  readonly orientation: BoardOrientation;
  readonly fen: string;
  readonly turn: PieceColor;
  readonly inCheck: boolean;
  readonly status: ChessBoardProbeStatus;
  readonly pieces: readonly ChessBoardProbePiece[];
};

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function statusOf(chess: Chess): ChessBoardProbeStatus {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isDraw()) return 'draw';
  return 'playing';
}

function probePieces(
  chess: Chess,
  size: number,
  orientation: BoardOrientation
): ChessBoardProbePiece[] {
  const position = positionFromChess(chess);
  const pieces: ChessBoardProbePiece[] = [];
  for (let i = 0; i < 64; i += 1) {
    const p = position[i];
    if (p === null || p === undefined) continue;
    const code = pieceCode(p.color, p.type);
    if (code === null) continue;
    const square = squareFromIndex(i);
    const center = squareCenter(square, size, orientation);
    pieces.push({
      square,
      piece: code,
      x: center.x,
      y: center.y,
    });
  }
  return pieces;
}

export function buildChessBoardProbe(args: {
  readonly fen?: string;
  readonly size: number;
  readonly orientation: BoardOrientation;
  readonly interaction: ChessBoardProbeInteraction;
}): ChessBoardProbe {
  const fen =
    args.fen !== undefined && args.fen.length > 0 ? args.fen : START_FEN;
  const chess = new Chess(fen);
  return {
    size: args.size,
    orientation: args.orientation,
    fen,
    turn: chess.turn(),
    inCheck: chess.inCheck(),
    status: statusOf(chess),
    ...args.interaction,
    legalTargets: [...args.interaction.legalTargets].sort(),
    pieces: probePieces(chess, args.size, args.orientation),
  };
}

export function parseChessBoardProbe(text: string | null): ChessBoardProbe {
  if (text === null || text.length === 0) {
    throw new Error('chess board probe: empty text');
  }
  const parsed = JSON.parse(text) as ChessBoardProbe;
  if (
    typeof parsed.size !== 'number' ||
    (parsed.orientation !== 'white' && parsed.orientation !== 'black') ||
    typeof parsed.fen !== 'string' ||
    (parsed.turn !== 'w' && parsed.turn !== 'b') ||
    !Array.isArray(parsed.pieces) ||
    !Array.isArray(parsed.legalTargets) ||
    !Array.isArray(parsed.premoves)
  ) {
    throw new Error('chess board probe: invalid shape');
  }
  return parsed;
}
