/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
import {
  Chess,
  type Color as ChessColor,
  type Move as ChessJsMove,
  type PieceSymbol as ChessPieceSymbol,
  type Square as ChessSquare,
} from 'chess.js';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  applyExternalFenToChess,
  type ApplyExternalFenResult,
} from './chess-board-apply-external-fen';
import { isSquare } from './chess-board-geometry';
import { positionFromChess } from './chess-board-position-from-chess';
import type { Move, Square } from './chess-board-types';

export type UseChessGameOptions = {
  initialFen?: string;
};

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
    // Drop path only needs check + game-over. Avoid fan-out of
    // isCheckmate/isStalemate/isDraw/isGameOver (each re-scans moves).
    const inCheck = chess.inCheck();
    const isGameOver = chess.isGameOver();
    return {
      ok: true,
      move: mapped,
      inCheck,
      isCheckmate: isGameOver && inCheck,
      isStalemate: false,
      isDraw: isGameOver && !inCheck,
      isGameOver,
    };
  } catch {
    return { ok: false };
  }
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
  // Status flags are fen-derived; cache them with the position so every
  // hover/selection re-render does not re-enter chess.js move generation.
  const status = useMemo(() => {
    // Once per fen — not every hover/selection re-render.
    const inCheck = chess.inCheck();
    const isCheckmate = chess.isCheckmate();
    const isDraw = chess.isDraw();
    return {
      turn: chess.turn() as 'w' | 'b',
      inCheck,
      isCheckmate,
      isDraw,
      isStalemate: chess.isStalemate(),
      isGameOver: isCheckmate || isDraw,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);
  const { turn, inCheck, isGameOver, isCheckmate, isStalemate, isDraw } =
    status;

  const legalMovesFrom = useCallback(
    (from: Square): readonly Square[] => {
      const moves = chess.moves({
        square: from as unknown as ChessSquare,
        verbose: true,
      }) as ChessJsMove[];
      // Promotions yield one move per piece choice (q/r/b/n) with the same
      // `to` square — dedupe so render keys stay unique.
      const targets = new Set(moves.map((m) => String(m.to)));
      return [...targets].filter(isSquare) as readonly Square[];
    },
    [chess]
  );

  const moveRequiresPromotion = useCallback(
    (from: Square, to: Square) => {
      // Fast reject: only pawns arriving on the last rank can promote.
      const piece = chess.get(from as unknown as ChessSquare);
      if (!piece || piece.type !== 'p') return false;
      const toRank = to[1];
      if (piece.color === 'w' ? toRank !== '8' : toRank !== '1') return false;
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

  const tryMoveSilent = useCallback(
    (m: { from: Square; to: Square; promotion?: Move['promotion'] }) => {
      return tryMoveOnMutableChess(chess, m);
    },
    [chess]
  );

  const commitMoveUi = useCallback(
    (move: Move) => {
      setLastMove(move);
      sync();
    },
    [sync]
  );

  const tryMove = useCallback(
    (m: { from: Square; to: Square; promotion?: Move['promotion'] }) => {
      const r = tryMoveSilent(m);
      if (!r.ok) return r;
      commitMoveUi(r.move);
      return r;
    },
    [tryMoveSilent, commitMoveUi]
  );

  const reset = useCallback(
    (nextFen?: string) => {
      if (nextFen !== undefined && nextFen === chess.fen()) {
        // Controlled boards often echo the fen we already applied in
        // tryMove; skip load + lastMove wipe (extra Skia js→wasm).
        return;
      }
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

  /**
   * Controlled / external FEN path: load the position and report whether it
   * was a single ply (caller sets lastMove + SFX when still in sync).
   */
  const applyExternalFen = useCallback(
    (nextFen: string): ApplyExternalFenResult | null => {
      const result = applyExternalFenToChess(chess, nextFen);
      if (result === null) return null;
      setFen(chess.fen());
      return result;
    },
    [chess]
  );

  const clearLastMove = useCallback(() => {
    setLastMove(null);
  }, []);

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
    tryMoveSilent,
    commitMoveUi,
    reset,
    applyExternalFen,
    clearLastMove,
    undo,
    pgn,
    loadPgn,
  };
}
