/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Chess,
  type Color as ChessColor,
  type Move as ChessJsMove,
  type PieceSymbol as ChessPieceSymbol,
  type Square as ChessSquare,
} from 'chess.js';
import type { Move, Piece, Position, Square } from './chess-board-types';
import { indexFromSquare, isSquare } from './chess-board-geometry';

export type UseChessGameOptions = {
  initialFen?: string;
};

function pieceFromChessJs(
  p: { type: ChessPieceSymbol; color: ChessColor } | null
): Piece | null {
  if (p === null) return null;
  const color = p.color === 'w' ? 'w' : 'b';
  const type = p.type;
  if (
    type !== 'p' &&
    type !== 'n' &&
    type !== 'b' &&
    type !== 'r' &&
    type !== 'q' &&
    type !== 'k'
  ) {
    return null;
  }
  return { color, type };
}

function positionFromChess(chess: Chess): Position {
  const board = chess.board(); // 8x8, rank 8..1
  const out: (Piece | null)[] = Array.from({ length: 64 }, () => null);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row]?.[col] ?? null;
      const file = String.fromCharCode('a'.charCodeAt(0) + col);
      const rank = String(8 - row);
      const square = `${file}${rank}` as Square;
      out[indexFromSquare(square)] = pieceFromChessJs(piece);
    }
  }
  return out;
}

function rookCastleFromSan(
  color: ChessColor,
  san: string | undefined
): { rookFrom: Square; rookTo: Square } | undefined {
  if (!san) return undefined;
  // Queenside first: "O-O-O" contains substring "O-O"
  if (san.includes('O-O-O')) {
    return color === 'w'
      ? { rookFrom: 'a1' as Square, rookTo: 'd1' as Square }
      : { rookFrom: 'a8' as Square, rookTo: 'd8' as Square };
  }
  if (san.includes('O-O')) {
    return color === 'w'
      ? { rookFrom: 'h1' as Square, rookTo: 'f1' as Square }
      : { rookFrom: 'h8' as Square, rookTo: 'f8' as Square };
  }
  return undefined;
}

function mapMove(m: ChessJsMove): Move {
  const from = m.from as unknown as Square;
  const to = m.to as unknown as Square;
  const promotion = m.promotion as ChessPieceSymbol | undefined;
  const promotionOut =
    promotion === 'q' ||
    promotion === 'r' ||
    promotion === 'b' ||
    promotion === 'n'
      ? promotion
      : undefined;
  const captured = m.captured as ChessPieceSymbol | undefined;
  const capturedOut =
    captured === 'p' ||
    captured === 'n' ||
    captured === 'b' ||
    captured === 'r' ||
    captured === 'q' ||
    captured === 'k'
      ? captured
      : undefined;
  const castle = rookCastleFromSan(m.color, m.san);
  const enPassant =
    'isEnPassant' in m && typeof m.isEnPassant === 'function' && m.isEnPassant()
      ? (true as const)
      : undefined;
  return {
    from,
    to,
    ...(promotionOut ? { promotion: promotionOut } : {}),
    san: m.san,
    ...(capturedOut ? { captured: capturedOut } : {}),
    ...(castle ? { castle } : {}),
    ...(enPassant ? { enPassant } : {}),
  };
}

export type TryMoveOk = {
  ok: true;
  move: Move;
  inCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
};

export type TryMoveResult = TryMoveOk | { ok: false };

function tryMoveOnMutableChess(
  chess: Chess,
  m: { from: Square; to: Square; promotion?: Move['promotion'] }
): TryMoveResult {
  try {
    const result = chess.move({
      from: m.from,
      to: m.to,
      ...(m.promotion ? { promotion: m.promotion } : {}),
    });
    const mapped = mapMove(result);
    return {
      ok: true,
      move: mapped,
      inCheck: chess.inCheck(),
      isCheckmate: chess.isCheckmate(),
      isStalemate: chess.isStalemate(),
      isDraw: chess.isDraw(),
      isGameOver: chess.isGameOver(),
    };
  } catch {
    return { ok: false };
  }
}

/** Validate a ply on a throwaway position (controlled board: parent owns FEN). */
export function tryMoveOnFen(
  fen: string,
  m: { from: Square; to: Square; promotion?: Move['promotion'] }
): TryMoveResult {
  return tryMoveOnMutableChess(new Chess(fen), m);
}

export function moveRequiresPromotionOnFen(
  fen: string,
  from: Square,
  to: Square
): boolean {
  const chess = new Chess(fen);
  const moves = chess.moves({
    square: from as unknown as ChessSquare,
    verbose: true,
  }) as ChessJsMove[];
  for (const mv of moves) {
    if (String(mv.to) === to && mv.promotion) return true;
  }
  return false;
}

export function useChessGame(options: UseChessGameOptions = {}) {
  const initialFen = options.initialFen;

  const chessRef = useRef<Chess>(new Chess(initialFen));
  const chess = chessRef.current;

  const [fen, setFen] = useState(() => chess.fen());
  const [lastMove, setLastMove] = useState<Move | null>(null);

  const sync = useCallback(() => {
    setFen(chess.fen());
  }, [chess]);

  // chess is stable (useRef), but exhaustive-deps can't see that.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const position = useMemo(() => positionFromChess(chess), [fen]);
  const turn = chess.turn();
  const inCheck = chess.inCheck();
  const isGameOver = chess.isGameOver();
  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();
  const isDraw = chess.isDraw();

  const legalMovesFrom = useCallback(
    (from: Square): readonly Square[] => {
      const moves = chess.moves({
        square: from as unknown as ChessSquare,
        verbose: true,
      }) as ChessJsMove[];
      return moves
        .map((m) => String(m.to))
        .filter(isSquare) as readonly Square[];
    },
    [chess]
  );

  const moveRequiresPromotion = useCallback(
    (from: Square, to: Square) => {
      const moves = chess.moves({
        square: from,
        verbose: true,
      }) as ChessJsMove[];
      for (const m of moves) {
        if (String(m.to) === to && m.promotion) return true;
      }
      return false;
    },
    [chess]
  );

  const tryMove = useCallback(
    (m: { from: Square; to: Square; promotion?: Move['promotion'] }) => {
      const r = tryMoveOnMutableChess(chess, m);
      if (!r.ok) return r;
      setLastMove(r.move);
      sync();
      return r;
    },
    [chess, sync]
  );

  const reset = useCallback(
    (nextFen?: string) => {
      setLastMove(null);
      try {
        if (nextFen) chess.load(nextFen);
        else chess.reset();
      } finally {
        setFen(chess.fen());
      }
    },
    [chess]
  );

  const undo = useCallback(() => {
    const res = chess.undo();
    if (res) {
      setLastMove(null);
      sync();
    }
    return res !== null;
  }, [chess, sync]);

  const pgn = useCallback(() => chess.pgn(), [chess]);
  const loadPgn = useCallback(
    (pgnText: string) => {
      try {
        chess.loadPgn(pgnText);
        setLastMove(null);
        sync();
        return true;
      } catch {
        return false;
      }
    },
    [chess, sync]
  );

  return {
    fen,
    turn,
    position,
    lastMove,
    inCheck,
    isGameOver,
    isCheckmate,
    isStalemate,
    isDraw,
    legalMovesFrom,
    moveRequiresPromotion,
    tryMove,
    reset,
    undo,
    pgn,
    loadPgn,
  };
}
