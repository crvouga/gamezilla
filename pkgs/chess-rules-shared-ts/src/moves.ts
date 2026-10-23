/**
 * Legal-move generation and move application. chess.js is the move generator
 * (spec §1 allows adopting a proven library); this module is the single place
 * the rest of the repo turns UCI / SAN into legal moves, so castling-input
 * normalization and promotion handling live here once.
 */
import { Chess, type Move as ChessJsMove } from 'chess.js';

import { parseFen } from './fen';
import type { Promotion, UciMove } from './uci';
import { parseUci } from './uci';

export type LegalMove = UciMove & {
  readonly uci: string;
  readonly san: string;
  readonly isCapture: boolean;
  readonly isCastle: boolean;
  readonly isEnPassant: boolean;
};

export type PositionStatus = {
  readonly isCheck: boolean;
  readonly isCheckmate: boolean;
  readonly isStalemate: boolean;
};

export type ApplyResult =
  | ({
      readonly ok: true;
      readonly fen: string;
      /** Canonical UCI actually played (castling normalized to king-two-squares). */
      readonly uci: string;
      readonly san: string;
    } & PositionStatus)
  | {
      readonly ok: false;
      readonly reason: 'invalidFen' | 'malformedUci' | 'illegal';
    };

function toLegalMove(m: ChessJsMove): LegalMove {
  const promotion = m.promotion as Promotion | undefined;
  const base = { from: m.from, to: m.to, uci: m.lan, san: m.san };
  return {
    ...base,
    ...(promotion !== undefined ? { promotion } : {}),
    isCapture: m.isCapture(),
    isCastle: isCastle(m),
    isEnPassant: m.isEnPassant(),
  };
}

/** Legal moves of a live chess.js position (the kernel's move generator). */
export function legalMovesOf(chess: Chess): readonly LegalMove[] {
  return chess.moves({ verbose: true }).map(toLegalMove);
}

function loadChess(fen: string): Chess | null {
  if (!parseFen(fen).ok) return null;
  return new Chess(fen);
}

export function legalMoves(fen: string): readonly LegalMove[] {
  const chess = loadChess(fen);
  return chess === null ? [] : legalMovesOf(chess);
}

export function positionStatusOf(chess: Chess): PositionStatus {
  return {
    isCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
  };
}

type Square = Parameters<Chess['get']>[0];

function isCastle(m: ChessJsMove): boolean {
  return m.isKingsideCastle() || m.isQueensideCastle();
}

/** Home square of the rook a standard castle moves (`e1g1` → `h1`). */
function castleRookSquare(m: ChessJsMove): string {
  const rank = m.from[1] ?? '';
  return `${m.isKingsideCastle() ? 'h' : 'a'}${rank}`;
}

/**
 * The castling move a king-onto-own-rook input (`e1h1`) stands for, when that
 * castle is legal in `chess`; `null` otherwise. Board input layers use it so a
 * king dropped on its own rook castles (spec §3).
 */
export function castlingFromRookInput(
  chess: Chess,
  move: UciMove
): UciMove | null {
  const piece = chess.get(move.from as Square);
  const target = chess.get(move.to as Square);
  if (
    piece?.type !== 'k' ||
    target?.type !== 'r' ||
    target.color !== piece.color ||
    move.promotion !== undefined
  ) {
    return null;
  }
  const kingside = move.to > move.from;
  const castle = chess
    .moves({ square: move.from as Square, verbose: true })
    .find((m) => (kingside ? m.isKingsideCastle() : m.isQueensideCastle()));
  return castle === undefined ? null : { from: castle.from, to: castle.to };
}

/**
 * Own-rook squares a king on `from` may be dropped onto to castle (one per
 * legal castle). Empty for any other piece or when no castle is legal.
 */
export function castlingRookTargets(
  chess: Chess,
  from: string
): readonly string[] {
  if (chess.get(from as Square)?.type !== 'k') return [];
  return chess
    .moves({ square: from as Square, verbose: true })
    .filter(isCastle)
    .map(castleRookSquare);
}

function tryMove(chess: Chess, move: UciMove): ChessJsMove | null {
  let played: ChessJsMove;
  try {
    played = chess.move(move);
  } catch {
    return null;
  }
  // chess.js ignores a promotion suffix on a non-promoting move; we don't.
  if (move.promotion !== undefined && played.promotion === undefined) {
    chess.undo();
    return null;
  }
  return played;
}

function playParsed(chess: Chess, move: UciMove): ChessJsMove | null {
  const direct = tryMove(chess, move);
  if (direct !== null) return direct;
  const alias = castlingFromRookInput(chess, move);
  return alias === null ? null : tryMove(chess, alias);
}

/**
 * Plays `uci` on a live chess.js instance in place. Castling is accepted both
 * as king-two-squares (`e1g1`) and as king-onto-own-rook (`e1h1`). A pawn move
 * to the last rank without a promotion suffix is illegal — promotion is never
 * guessed (spec §3: never auto-queen silently). Returns the SAN, or `null`
 * (instance untouched) when malformed or illegal.
 */
export function playUci(chess: Chess, uci: string): string | null {
  const parsed = parseUci(uci);
  if (parsed === null) return null;
  return playParsed(chess, parsed)?.san ?? null;
}

export function applyUci(fen: string, uci: string): ApplyResult {
  const chess = loadChess(fen);
  if (chess === null) return { ok: false, reason: 'invalidFen' };
  const parsed = parseUci(uci);
  if (parsed === null) return { ok: false, reason: 'malformedUci' };
  const played = playParsed(chess, parsed);
  if (played === null) return { ok: false, reason: 'illegal' };
  return {
    ok: true,
    fen: chess.fen(),
    uci: played.lan,
    san: played.san,
    ...positionStatusOf(chess),
  };
}

export function positionStatus(fen: string): PositionStatus | null {
  const chess = loadChess(fen);
  return chess === null ? null : positionStatusOf(chess);
}

/** SAN already marks legal mating moves; avoid applying every candidate again. */
export function hasMateInOne(fen: string): boolean {
  const chess = loadChess(fen);
  return chess !== null && chess.moves().some((san) => san.endsWith('#'));
}

/** SAN for a legal UCI move (`Nbd7`, `R1e2`, `e8=Q#`, `O-O`); `null` if illegal. */
export function sanFromUci(fen: string, uci: string): string | null {
  const result = applyUci(fen, uci);
  return result.ok ? result.san : null;
}

/** Canonical UCI for a SAN move in `fen`; `null` when not a legal move. */
export function uciFromSan(fen: string, san: string): string | null {
  const chess = loadChess(fen);
  if (chess === null) return null;
  try {
    return chess.move(san.trim()).lan;
  } catch {
    return null;
  }
}

function perftOf(chess: Chess, depth: number): number {
  // Leaves are counted, not built: `legalMovesOf` maps chess.js's moves one to
  // one, and skipping the verbose objects (each carries two FENs) makes perft
  // ~7x cheaper — cheap enough to stay far inside a test's time budget.
  if (depth === 1) return chess.moves().length;
  const moves = legalMovesOf(chess);
  let nodes = 0;
  for (const m of moves) {
    chess.move(m.promotion === undefined ? { from: m.from, to: m.to } : m);
    nodes += perftOf(chess, depth - 1);
    chess.undo();
  }
  return nodes;
}

/** Leaf-node count of the legal-move tree to `depth` (depth 0 → 1). */
export function perft(fen: string, depth: number): number {
  const chess = loadChess(fen);
  if (chess === null) throw new Error(`perft: invalid FEN '${fen}'`);
  if (!Number.isInteger(depth) || depth < 0) {
    throw new Error(
      `perft: depth must be a non-negative integer, got ${depth}`
    );
  }
  return depth === 0 ? 1 : perftOf(chess, depth);
}
