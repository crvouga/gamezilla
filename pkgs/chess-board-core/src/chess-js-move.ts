/** Map chess.js verbose moves onto the board {@link Move} shape. */

import type {
  Color as ChessColor,
  Move as ChessJsMove,
  PieceSymbol as ChessPieceSymbol,
} from 'chess.js';
import type { Move, Square } from './types';

function rookCastleFromSan(
  color: ChessColor,
  san: string | undefined
): { rookFrom: Square; rookTo: Square } | undefined {
  if (!san) return undefined;
  // Queenside first: "O-O-O" contains substring "O-O"
  if (san.includes('O-O-O')) {
    return color === 'w'
      ? { rookFrom: 'a1', rookTo: 'd1' }
      : { rookFrom: 'a8', rookTo: 'd8' };
  }
  if (san.includes('O-O')) {
    return color === 'w'
      ? { rookFrom: 'h1', rookTo: 'f1' }
      : { rookFrom: 'h8', rookTo: 'f8' };
  }
  return undefined;
}

function promotionOf(p: ChessPieceSymbol | undefined): Move['promotion'] {
  return p === 'q' || p === 'r' || p === 'b' || p === 'n' ? p : undefined;
}

function capturedOf(c: ChessPieceSymbol | undefined): Move['captured'] {
  return c === 'p' ||
    c === 'n' ||
    c === 'b' ||
    c === 'r' ||
    c === 'q' ||
    c === 'k'
    ? c
    : undefined;
}

export function moveFromChessJs(m: ChessJsMove): Move {
  const from = m.from as unknown as Square;
  const to = m.to as unknown as Square;
  const promotion = promotionOf(m.promotion as ChessPieceSymbol | undefined);
  const captured = capturedOf(m.captured as ChessPieceSymbol | undefined);
  const castle = rookCastleFromSan(m.color, m.san);
  const enPassant =
    'isEnPassant' in m && typeof m.isEnPassant === 'function' && m.isEnPassant()
      ? (true as const)
      : undefined;
  return {
    from,
    to,
    ...(promotion ? { promotion } : {}),
    san: m.san,
    ...(captured ? { captured } : {}),
    ...(castle ? { castle } : {}),
    ...(enPassant ? { enPassant } : {}),
  };
}
