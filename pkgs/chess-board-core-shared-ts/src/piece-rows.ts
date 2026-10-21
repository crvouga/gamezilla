/**
 * Stable piece identities across position changes so renderers can slide a
 * piece between squares instead of unmounting / remounting it.
 *
 * {@link createPieceRowsTracker} is the stateful entry point: feed it each
 * new position (+ the move that produced it when known) and it returns rows
 * whose `id`s (and object identity) survive moves, captures, castling,
 * promotions and resets — Solid `<For>` reconciles by reference.
 */

import { squareFromIndex } from './geometry';
import { inferLastMoveFromPositionDiff } from './infer-move';
import { pieceCode } from './piece-code';
import { positionsEqual } from './position';
import type { Move, PieceCode, Position, Square } from './types';

export type ChessPieceRow = {
  id: string;
  square: Square;
  code: PieceCode;
};

type IdAllocator = () => string;

function createIdAllocator(prefix: string): IdAllocator {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function scanRows(pos: Position, allocId: IdAllocator): ChessPieceRow[] {
  const rows: ChessPieceRow[] = [];
  for (let i = 0; i < 64; i++) {
    const p = pos[i];
    if (!p) continue;
    const code = pieceCode(p.color, p.type);
    if (!code) continue;
    rows.push({ id: allocId(), square: squareFromIndex(i), code });
  }
  return rows;
}

/** Reuse the prior row object when the id survives; allocate only for new ids. */
function adoptRow(
  prevById: Map<string, ChessPieceRow>,
  id: string,
  square: Square,
  code: PieceCode
): ChessPieceRow {
  const existing = prevById.get(id);
  if (existing !== undefined) {
    existing.square = square;
    existing.code = code;
    return existing;
  }
  return { id, square, code };
}

type ResolvePieceArgs = {
  sq: Square;
  code: PieceCode;
  active: readonly ChessPieceRow[];
  lastMove: Move;
  mover: ChessPieceRow | undefined;
  allocId: IdAllocator;
};

function resolvePieceId(args: ResolvePieceArgs): string {
  const { sq, code, active, lastMove, mover, allocId } = args;
  if (mover && sq === lastMove.to) {
    return mover.id;
  }
  const castle = lastMove.castle;
  if (castle && sq === castle.rookTo) {
    const rook = active.find((r) => r.square === castle.rookFrom);
    return rook ? rook.id : allocId();
  }
  const same = active.find((r) => r.square === sq && r.code === code);
  return same ? same.id : allocId();
}

function buildNextRows(
  position: Position,
  active: readonly ChessPieceRow[],
  lastMove: Move,
  allocId: IdAllocator
): ChessPieceRow[] {
  const prevById = new Map(active.map((r) => [r.id, r]));
  const mover = active.find((r) => r.square === lastMove.from);
  const next: ChessPieceRow[] = [];
  for (let i = 0; i < 64; i++) {
    const p = position[i];
    if (!p) continue;
    const sq = squareFromIndex(i);
    const code = pieceCode(p.color, p.type);
    if (!code) continue;
    const id = resolvePieceId({
      sq,
      code,
      active,
      lastMove,
      mover,
      allocId,
    });
    next.push(adoptRow(prevById, id, sq, code));
  }
  return next;
}

function indexPrevRows(prevRows: readonly ChessPieceRow[]): {
  bySquareCode: Map<string, ChessPieceRow>;
  byCode: Map<PieceCode, ChessPieceRow[]>;
} {
  const bySquareCode = new Map<string, ChessPieceRow>();
  const byCode = new Map<PieceCode, ChessPieceRow[]>();
  for (const r of prevRows) {
    bySquareCode.set(`${r.square}:${r.code}`, r);
    const list = byCode.get(r.code) ?? [];
    list.push(r);
    byCode.set(r.code, list);
  }
  return { bySquareCode, byCode };
}

type Unmatched = { square: Square; code: PieceCode };

function claimSquareMatches(
  position: Position,
  bySquareCode: Map<string, ChessPieceRow>,
  usedIds: Set<string>,
  prevById: Map<string, ChessPieceRow>
): { matched: ChessPieceRow[]; unmatched: Unmatched[] } {
  const matched: ChessPieceRow[] = [];
  const unmatched: Unmatched[] = [];
  for (let i = 0; i < 64; i++) {
    const p = position[i];
    if (!p) continue;
    const code = pieceCode(p.color, p.type);
    if (!code) continue;
    const square = squareFromIndex(i);
    const hit = bySquareCode.get(`${square}:${code}`);
    if (hit && !usedIds.has(hit.id)) {
      usedIds.add(hit.id);
      matched.push(adoptRow(prevById, hit.id, square, code));
    } else {
      unmatched.push({ square, code });
    }
  }
  return { matched, unmatched };
}

/** Squared distance between two squares, in cells. */
function squareDistance(a: Square, b: Square): number {
  const files = a.charCodeAt(0) - b.charCodeAt(0);
  const ranks = a.charCodeAt(1) - b.charCodeAt(1);
  return files * files + ranks * ranks;
}

/**
 * The closest piece of the same kind that has not been claimed: it is the
 * one that slides there, so a replacement position moves each piece the
 * shortest way instead of sending pieces across each other.
 */
function nearestUnused(
  square: Square,
  candidates: readonly ChessPieceRow[] | undefined,
  usedIds: ReadonlySet<string>
): ChessPieceRow | undefined {
  let best: ChessPieceRow | undefined;
  for (const candidate of candidates ?? []) {
    if (usedIds.has(candidate.id)) continue;
    if (
      best === undefined ||
      squareDistance(candidate.square, square) <
        squareDistance(best.square, square)
    )
      best = candidate;
  }
  return best;
}

function claimCodeFallback(
  unmatched: readonly Unmatched[],
  ctx: {
    byCode: Map<PieceCode, ChessPieceRow[]>;
    usedIds: Set<string>;
    allocId: IdAllocator;
    prevById: Map<string, ChessPieceRow>;
  }
): ChessPieceRow[] {
  const out: ChessPieceRow[] = [];
  for (const row of unmatched) {
    const hit = nearestUnused(
      row.square,
      ctx.byCode.get(row.code),
      ctx.usedIds
    );
    if (hit) {
      ctx.usedIds.add(hit.id);
      out.push(adoptRow(ctx.prevById, hit.id, row.square, row.code));
    } else {
      out.push({
        id: ctx.allocId(),
        square: row.square,
        code: row.code,
      });
    }
  }
  return out;
}

/**
 * Rematch piece ids across a non-ply position swap (puzzle reset / fen jump)
 * so resting pieces keep identity and can slide instead of remounting.
 */
export function rematchRows(
  prevRows: readonly ChessPieceRow[],
  position: Position,
  allocId: IdAllocator
): ChessPieceRow[] {
  const prevById = new Map(prevRows.map((r) => [r.id, r]));
  const { bySquareCode, byCode } = indexPrevRows(prevRows);
  const usedIds = new Set<string>();
  const { matched, unmatched } = claimSquareMatches(
    position,
    bySquareCode,
    usedIds,
    prevById
  );
  return [
    ...matched,
    ...claimCodeFallback(unmatched, { byCode, usedIds, allocId, prevById }),
  ];
}

export type PieceRowsTracker = {
  /** Rows for `position`; identical position returns the cached rows. */
  readonly next: (position: Position, lastMove: Move | null) => ChessPieceRow[];
  readonly current: () => readonly ChessPieceRow[];
};

/**
 * Stateful identity tracker. Ids are scoped to the tracker (`<prefix>-N`) so
 * two boards on one screen never collide.
 */
export function createPieceRowsTracker(prefix = 'cp'): PieceRowsTracker {
  const allocId = createIdAllocator(prefix);
  let cache: { position: Position; rows: ChessPieceRow[] } | null = null;
  return {
    next(position, lastMove) {
      if (cache === null) {
        cache = { position, rows: scanRows(position, allocId) };
      } else if (!positionsEqual(cache.position, position)) {
        const move =
          lastMove ?? inferLastMoveFromPositionDiff(cache.position, position);
        const rows = move
          ? buildNextRows(position, cache.rows, move, allocId)
          : rematchRows(cache.rows, position, allocId);
        cache = { position, rows };
      }
      return cache.rows;
    },
    current: () => cache?.rows ?? [],
  };
}
