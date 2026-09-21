/**
 * Framework-free chess game state over chess.js: position + status snapshot,
 * legal-move queries, move application, external-FEN sync and last-move
 * tracking. Exposes `getSnapshot` / `subscribe` so the Solid binding
 * (`createSubscriptionSignal`) binds to it without duplicating game logic.
 */

import {
  castlingFromRookInput,
  castlingRookTargets,
} from '@pkgs/chess-rules/moves';
import {
  Chess,
  type Move as ChessJsMove,
  type Square as ChessSquare,
  validateFen,
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
function playOnChess(chess: Chess, m: MoveInput): ChessJsMove {
  const input = {
    from: m.from,
    to: m.to,
    ...(m.promotion ? { promotion: m.promotion } : {}),
  };
  try {
    return chess.move(input);
  } catch (error) {
    // A king dropped on its own rook stands for that castle (spec §3).
    const castle = castlingFromRookInput(chess, input);
    if (castle === null) throw error;
    return chess.move(castle);
  }
}

export function tryMoveOnChess(chess: Chess, m: MoveInput): TryMoveResult {
  try {
    const move = moveFromChessJs(playOnChess(chess, m));
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
  // Parent / server data: a malformed FEN keeps the current position.
  if (!validateFen(nextFen).ok) return null;
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

  /** A malformed `initialFen` falls back to the start position. */
  constructor(initialFen?: string) {
    this.chess = new Chess(
      initialFen !== undefined && validateFen(initialFen).ok
        ? initialFen
        : undefined
    );
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

  /**
   * Distinct destination squares reachable from `from` (promotions deduped).
   * A king also lists its own rook's square for every legal castle, so a tap
   * or drop on the rook castles instead of re-selecting the rook.
   */
  legalMovesFrom(from: Square): readonly Square[] {
    const moves = this.chess.moves({
      square: from as unknown as ChessSquare,
      verbose: true,
    }) as ChessJsMove[];
    const targets = new Set(moves.map((m) => String(m.to)));
    for (const rook of castlingRookTargets(this.chess, from)) targets.add(rook);
    return [...targets].filter(isSquare);
  }

  /**
   * Destinations for a premove: flips the side-to-move in a temp engine so
   * your pieces show targets while the opponent is to move.
   */
  premoveTargetsFrom(from: Square): readonly Square[] {
    const parts = this.chess.fen().split(' ');
    if (parts.length < 2) return [];
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    try {
      const tmp = new Chess(parts.join(' '));
      const moves = tmp.moves({
        square: from as unknown as ChessSquare,
        verbose: true,
      }) as ChessJsMove[];
      const targets = new Set(moves.map((m) => String(m.to)));
      return [...targets].filter(isSquare);
    } catch {
      return [];
    }
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
