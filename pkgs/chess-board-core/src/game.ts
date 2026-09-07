/**
 * Framework-free chess game state over chess.js: position + status snapshot,
 * legal-move queries, move application, external-FEN sync and last-move
 * tracking. Exposes `getSnapshot` / `subscribe` so UI bindings
 * (`useSyncExternalStore`) and Solid (`createSubscriptionSignal`) bind to it
 * without duplicating game logic.
 */

import {
  Chess,
  type Move as ChessJsMove,
  type Square as ChessSquare,
} from 'chess.js';
import { moveFromChessJs } from './chess-js-move';
import { isSquare } from './geometry';
import { inferLastMoveFromPositionDiff } from './infer-move';
import { positionFromChess } from './position';
import type { Move, PieceColor, Position, Square } from './types';

export type MoveInput = {
  from: Square;
  to: Square;
  promotion?: Move['promotion'];
};

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

export type ApplyExternalFenResult = {
  moved: Move | null;
  inCheck: boolean;
  isGameOver: boolean;
};

export type ChessGameSnapshot = {
  readonly fen: string;
  readonly turn: PieceColor;
  readonly position: Position;
  readonly lastMove: Move | null;
  readonly inCheck: boolean;
  readonly isCheckmate: boolean;
  readonly isStalemate: boolean;
  readonly isDraw: boolean;
  readonly isGameOver: boolean;
};

/**
 * Apply a move to a live chess.js instance without touching game snapshot
 * state (drop path only needs check + game-over; avoids the fan-out of
 * isCheckmate / isStalemate / isDraw which each re-scan moves).
 */
export function tryMoveOnChess(chess: Chess, m: MoveInput): TryMoveResult {
  try {
    const result = chess.move({
      from: m.from,
      to: m.to,
      ...(m.promotion ? { promotion: m.promotion } : {}),
    });
    const move = moveFromChessJs(result);
    const inCheck = chess.inCheck();
    const isGameOver = chess.isGameOver();
    return {
      ok: true,
      move,
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

/**
 * Load an external FEN onto a live chess.js instance. Same-FEN is a no-op
 * (`null`). When the new position is a single ply away, `moved` carries that
 * move for SFX / last-move highlights.
 */
export function applyExternalFenToChess(
  chess: Chess,
  nextFen: string
): ApplyExternalFenResult | null {
  if (nextFen === chess.fen()) return null;
  const prev = positionFromChess(chess);
  chess.load(nextFen);
  const moved = inferLastMoveFromPositionDiff(prev, positionFromChess(chess));
  return { moved, inCheck: chess.inCheck(), isGameOver: chess.isGameOver() };
}

function snapshotOf(chess: Chess, lastMove: Move | null): ChessGameSnapshot {
  const inCheck = chess.inCheck();
  const isCheckmate = chess.isCheckmate();
  const isDraw = chess.isDraw();
  return {
    fen: chess.fen(),
    turn: chess.turn(),
    position: positionFromChess(chess),
    lastMove,
    inCheck,
    isCheckmate,
    isStalemate: chess.isStalemate(),
    isDraw,
    isGameOver: isCheckmate || isDraw,
  };
}

export class ChessGame {
  private readonly chess: Chess;
  private snapshot: ChessGameSnapshot;
  private readonly listeners = new Set<() => void>();

  constructor(initialFen?: string) {
    this.chess = new Chess(initialFen);
    this.snapshot = snapshotOf(this.chess, null);
  }

  getSnapshot = (): ChessGameSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private commit(lastMove: Move | null): void {
    this.snapshot = snapshotOf(this.chess, lastMove);
    for (const listener of [...this.listeners]) listener();
  }

  /** Distinct destination squares reachable from `from` (promotions deduped). */
  legalMovesFrom(from: Square): readonly Square[] {
    const moves = this.chess.moves({
      square: from as unknown as ChessSquare,
      verbose: true,
    }) as ChessJsMove[];
    const targets = new Set(moves.map((m) => String(m.to)));
    return [...targets].filter(isSquare);
  }

  moveRequiresPromotion(from: Square, to: Square): boolean {
    const piece = this.chess.get(from as unknown as ChessSquare);
    if (!piece || piece.type !== 'p') return false;
    const toRank = to[1];
    if (piece.color === 'w' ? toRank !== '8' : toRank !== '1') return false;
    const moves = this.chess.moves({
      square: from,
      verbose: true,
    }) as ChessJsMove[];
    return moves.some((m) => String(m.to) === to && m.promotion !== undefined);
  }

  /** Apply without publishing a snapshot (caller follows with {@link commitMove}). */
  tryMoveSilent(m: MoveInput): TryMoveResult {
    return tryMoveOnChess(this.chess, m);
  }

  /** Publish the snapshot after a silent move. */
  commitMove(move: Move): void {
    this.commit(move);
  }

  tryMove(m: MoveInput): TryMoveResult {
    const r = this.tryMoveSilent(m);
    if (r.ok) this.commit(r.move);
    return r;
  }

  /** Load `nextFen` (or the start position); same-FEN echo is a no-op. */
  reset(nextFen?: string): void {
    if (nextFen !== undefined && nextFen === this.chess.fen()) return;
    try {
      if (nextFen) this.chess.load(nextFen);
      else this.chess.reset();
    } finally {
      this.commit(null);
    }
  }

  /** Controlled / external FEN path; caller sets last move when a single ply. */
  applyExternalFen(nextFen: string): ApplyExternalFenResult | null {
    const result = applyExternalFenToChess(this.chess, nextFen);
    if (result === null) return null;
    this.commit(result.moved);
    return result;
  }

  clearLastMove(): void {
    if (this.snapshot.lastMove === null) return;
    this.commit(null);
  }

  undo(): boolean {
    const res = this.chess.undo();
    if (res) this.commit(null);
    return res !== null;
  }

  pgn(): string {
    return this.chess.pgn();
  }

  loadPgn(pgnText: string): boolean {
    try {
      this.chess.loadPgn(pgnText);
      this.commit(null);
      return true;
    } catch {
      return false;
    }
  }
}
