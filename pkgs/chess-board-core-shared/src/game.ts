/**
 * Framework-free chess game state over chess.js: position + status snapshot,
 * legal-move queries, move application, external-FEN sync and last-move
 * tracking. Exposes `getSnapshot` / `subscribe` so the Solid binding
 * (`createSubscriptionSignal`) binds to it without duplicating game logic.
 */

import { castlingFromRookInput } from '@pkgs/chess-rules-shared/moves';
import { Chess, type Move as ChessJsMove, validateFen } from 'chess.js';
import { moveFromChessJs } from './chess-js-move';
import type { Destination } from './destinations';
import { allDestinationsFrom, destinationsFrom } from './destinations';
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

/**
 * Game status reuses the cached legal destinations. Checkmate and stalemate
 * come from that emptiness plus canonical check status; the other draw rules
 * read canonical material and counters without generating moves again.
 */
function statusOf(chess: Chess, hasLegalMoves: boolean) {
  const inCheck = chess.inCheck();
  const isCheckmate = inCheck && !hasLegalMoves;
  const isStalemate = !inCheck && !hasLegalMoves;
  const isDraw =
    isStalemate ||
    chess.isInsufficientMaterial() ||
    chess.isDrawByFiftyMoves() ||
    chess.isThreefoldRepetition();
  return {
    inCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    isGameOver: isCheckmate || isDraw,
  };
}

function snapshotOf(
  chess: Chess,
  lastMove: Move | null,
  hasLegalMoves: boolean,
  position: Position = positionFromChess(chess)
): ChessGameSnapshot {
  return {
    fen: chess.fen(),
    turn: chess.turn(),
    position,
    lastMove,
    ...statusOf(chess, hasLegalMoves),
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
    this.destinations = allDestinationsFrom(this.chess);
    this.snapshot = snapshotOf(this.chess, null, this.destinations.size > 0);
  }

  getSnapshot = (): ChessGameSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private commit(lastMove: Move | null, position?: Position): void {
    this.destinations = allDestinationsFrom(this.chess);
    this.publish(
      snapshotOf(this.chess, lastMove, this.destinations.size > 0, position)
    );
  }

  private publish(snapshot: ChessGameSnapshot): void {
    if (snapshot.fen !== this.snapshot.fen) {
      this.premoveTargets.clear();
    }
    this.snapshot = snapshot;
    for (const listener of [...this.listeners]) listener();
  }

  /** Per-position cache: a selection re-reads its targets on every publish. */
  private destinations: ReadonlyMap<Square, readonly Destination[]> = new Map<
    Square,
    readonly Destination[]
  >();
  private premoveTargets = new Map<Square, readonly Square[]>();

  private destinationsOf(from: Square): readonly Destination[] {
    return this.destinations.get(from) ?? [];
  }

  /** Canonical capture destinations, including an empty en passant square. */
  legalCapturesFrom(from: Square): readonly Square[] {
    return this.destinationsOf(from)
      .filter((d) => d.capture)
      .map((d) => d.to);
  }

  /**
   * Distinct destination squares reachable from `from` (promotions deduped).
   * A king also lists its own rook's square for every legal castle, so a tap
   * or drop on the rook castles instead of re-selecting the rook.
   */
  legalMovesFrom(from: Square): readonly Square[] {
    const out: Square[] = [];
    for (const d of this.destinationsOf(from)) {
      out.push(d.to);
      if (d.castle !== null) {
        const rook = `${d.castle === 'k' ? 'h' : 'a'}${from[1]}` as Square;
        if (!out.includes(rook)) out.push(rook);
      }
    }
    return out;
  }

  /**
   * Destinations for a premove: flips the side-to-move in a temp engine so
   * your pieces show targets while the opponent is to move.
   */
  premoveTargetsFrom(from: Square): readonly Square[] {
    const cached = this.premoveTargets.get(from);
    if (cached !== undefined) return cached;
    const fresh = this.computePremoveTargets(from);
    this.premoveTargets.set(from, fresh);
    return fresh;
  }

  private computePremoveTargets(from: Square): readonly Square[] {
    const parts = this.snapshot.fen.split(' ');
    if (parts.length < 2) return [];
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    try {
      const tmp = new Chess(parts.join(' '));
      return destinationsFrom(tmp, from).map((d) => d.to);
    } catch {
      return [];
    }
  }

  moveRequiresPromotion(from: Square, to: Square): boolean {
    return this.destinationsOf(from).some((d) => d.to === to && d.promotion);
  }

  /** Play `m`; status comes from the one snapshot the move publishes. */
  tryMove(m: MoveInput): TryMoveResult {
    let move: Move;
    try {
      move = moveFromChessJs(playOnChess(this.chess, m));
    } catch {
      return { ok: false };
    }
    this.commit(move);
    const s = this.snapshot;
    return {
      ok: true,
      move,
      inCheck: s.inCheck,
      isCheckmate: s.isCheckmate,
      isStalemate: s.isStalemate,
      isDraw: s.isDraw,
      isGameOver: s.isGameOver,
    };
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
  /**
   * Load an external FEN. Same-FEN is a no-op (`null`); a malformed FEN
   * (parent / server data) keeps the current position. When the new
   * position is a single ply away, `moved` carries that move for SFX /
   * last-move highlights. One snapshot, one legal-move generation.
   */
  applyExternalFen(nextFen: string): ApplyExternalFenResult | null {
    if (nextFen === this.snapshot.fen) return null;
    if (!validateFen(nextFen).ok) return null;
    if (new Chess(nextFen).fen() === this.snapshot.fen) return null;
    const next = new Chess(nextFen);
    const position = positionFromChess(next);
    const inferred = inferLastMoveFromPositionDiff(
      this.snapshot.position,
      position
    );
    const moved =
      inferred !== null &&
      !this.snapshot.isGameOver &&
      next.turn() !== this.snapshot.turn &&
      this.destinationsOf(inferred.from).some(
        (d) =>
          d.to === inferred.to &&
          d.promotion === (inferred.promotion !== undefined)
      )
        ? inferred
        : null;
    this.chess.load(nextFen);
    this.commit(moved, position);
    return {
      moved,
      inCheck: this.snapshot.inCheck,
      isGameOver: this.snapshot.isGameOver,
    };
  }

  /** Only the highlight changes: no position / status recompute. */
  clearLastMove(): void {
    if (this.snapshot.lastMove === null) return;
    this.publish({ ...this.snapshot, lastMove: null });
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
