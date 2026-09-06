/**
 * Infer the single ply between two positions (external FEN, engine reply,
 * opponent staging) so piece identities survive position swaps.
 */

import { indexFromSquare, squareFromIndex } from './geometry';
import { pieceEq } from './position';
import type { Move, Piece, PieceType, Position, Square } from './types';

type CellChange = { i: number; prev: Piece | null; next: Piece | null };

function collectChanges(prev: Position, next: Position): CellChange[] {
  const out: CellChange[] = [];
  for (let i = 0; i < 64; i++) {
    const pi = prev[i] ?? null;
    const ni = next[i] ?? null;
    if (!pieceEq(pi, ni)) out.push({ i, prev: pi, next: ni });
  }
  return out;
}

function sortIndices(a: number[]): number[] {
  return [...a].sort((x, y) => x - y);
}

function setsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = sortIndices(a);
  const sb = sortIndices(b);
  for (let k = 0; k < sa.length; k++) if (sa[k] !== sb[k]) return false;
  return true;
}

/** Single-ply diff → Move so piece rows keep stable ids (external FEN / engine). */
export function inferLastMoveFromPositionDiff(
  prev: Position,
  next: Position
): Move | null {
  const ch = collectChanges(prev, next);
  const n = ch.length;
  if (n === 0 || n > 4) return null;

  if (n === 2) return inferTwoSquareChange(ch);
  if (n === 3) return inferEnPassantChange(ch);
  if (n === 4) return inferCastleChange(prev, next, ch);
  return null;
}

function captureFromDestination(
  toPrev: Piece | null,
  moverColor: Piece['color']
): PieceType | undefined {
  if (toPrev !== null && toPrev.color !== moverColor && toPrev.type !== 'k') {
    return toPrev.type;
  }
  return undefined;
}

function promotionFromPawnLand(
  mover: Piece,
  landed: Piece
): Exclude<PieceType, 'p' | 'k'> | null {
  if (mover.type !== 'p' || landed.type === 'p') return null;
  if (landed.type === 'k') return null;
  return landed.type as Exclude<PieceType, 'p' | 'k'>;
}

function inferTwoSquareChange(ch: CellChange[]): Move | null {
  const fromCh = ch.find((c) => c.prev !== null && c.next === null);
  const toCh = ch.find((c) => c.next !== null);
  if (!fromCh || !toCh || fromCh.i === toCh.i) return null;

  const mover = fromCh.prev!;
  const landed = toCh.next!;
  if (mover.color !== landed.color) return null;

  const from = squareFromIndex(fromCh.i);
  const to = squareFromIndex(toCh.i);
  const captured = captureFromDestination(toCh.prev, mover.color);
  const promotion = promotionFromPawnLand(mover, landed) ?? undefined;

  return {
    from,
    to,
    ...(captured ? { captured } : {}),
    ...(promotion ? { promotion } : {}),
  };
}

function isDiagonalAdjacentPawnCapture(
  fromCand: CellChange,
  toCh: CellChange
): boolean {
  const fromFile = fromCand.i % 8;
  const toFile = toCh.i % 8;
  const fromRank = Math.floor(fromCand.i / 8);
  const toRank = Math.floor(toCh.i / 8);
  return Math.abs(fromFile - toFile) === 1 && Math.abs(fromRank - toRank) === 1;
}

type EpTriple = { fromCand: CellChange; toCh: CellChange; victim: CellChange };

function epEmptiesAndLanding(ch: CellChange[]): {
  empties: CellChange[];
  toCh: CellChange;
} | null {
  const empties = ch.filter((c) => c.prev !== null && c.next === null);
  const fills = ch.filter((c) => c.next !== null && c.prev === null);
  if (empties.length !== 2 || fills.length !== 1) return null;
  const toCh = fills[0];
  if (!toCh) return null;
  return { empties, toCh };
}

function epPawnFromAndVictim(
  empties: CellChange[],
  moverColor: Piece['color']
): { fromCand: CellChange; victim: CellChange } | null {
  const fromCand = empties.find((e) => {
    const p = e.prev;
    return p !== null && p.color === moverColor && p.type === 'p';
  });
  if (!fromCand) return null;
  const victim = empties.find((e) => e !== fromCand);
  const vp = victim?.prev;
  if (!victim || !vp || vp.type !== 'p' || vp.color === moverColor) return null;
  return { fromCand, victim };
}

function tryParseEpTriple(ch: CellChange[]): EpTriple | null {
  const head = epEmptiesAndLanding(ch);
  if (!head) return null;
  const { empties, toCh } = head;
  const mover = toCh.next;
  if (!mover || mover.type !== 'p') return null;
  const pair = epPawnFromAndVictim(empties, mover.color);
  if (!pair) return null;
  return { fromCand: pair.fromCand, toCh, victim: pair.victim };
}

function inferEnPassantChange(ch: CellChange[]): Move | null {
  const t = tryParseEpTriple(ch);
  if (!t) return null;
  const { fromCand, toCh, victim } = t;
  if (!isDiagonalAdjacentPawnCapture(fromCand, toCh)) return null;

  const epIdx = Math.floor(fromCand.i / 8) * 8 + (toCh.i % 8);
  if (victim.i !== epIdx) return null;

  return {
    from: squareFromIndex(fromCand.i),
    to: squareFromIndex(toCh.i),
    captured: 'p' as const,
    enPassant: true as const,
  };
}

type CastleSpec = {
  indices: number[];
  kingFrom: Square;
  kingTo: Square;
  rookFrom: Square;
  rookTo: Square;
};

const CASTLE_SPECS: CastleSpec[] = [
  {
    indices: [4, 5, 6, 7],
    kingFrom: 'e1',
    kingTo: 'g1',
    rookFrom: 'h1',
    rookTo: 'f1',
  },
  {
    indices: [0, 2, 3, 4],
    kingFrom: 'e1',
    kingTo: 'c1',
    rookFrom: 'a1',
    rookTo: 'd1',
  },
  {
    indices: [60, 61, 62, 63],
    kingFrom: 'e8',
    kingTo: 'g8',
    rookFrom: 'h8',
    rookTo: 'f8',
  },
  {
    indices: [56, 58, 59, 60],
    kingFrom: 'e8',
    kingTo: 'c8',
    rookFrom: 'a8',
    rookTo: 'd8',
  },
];

function kingEndsOk(pk: Piece | null, nk: Piece | null): pk is Piece {
  return !!(
    pk &&
    nk &&
    pk.type === 'k' &&
    nk.type === 'k' &&
    pk.color === nk.color
  );
}

function rookEndsMatchKing(
  pr: Piece | null,
  nr: Piece | null,
  king: Piece
): boolean {
  return !!(
    pr &&
    nr &&
    pr.type === 'r' &&
    nr.type === 'r' &&
    pr.color === nr.color &&
    pr.color === king.color
  );
}

type CastleIdx = { kf: number; kt: number; rf: number; rt: number };

function castleOriginsDestEmpty(
  prev: Position,
  next: Position,
  ix: CastleIdx
): boolean {
  const { kf, kt, rf, rt } = ix;
  return (
    (prev[kt] ?? null) === null &&
    (next[kf] ?? null) === null &&
    (prev[rt] ?? null) === null &&
    (next[rf] ?? null) === null
  );
}

function tryCastleSpec(
  spec: CastleSpec,
  prev: Position,
  next: Position,
  changeIndices: number[]
): Move | null {
  if (!setsEqual(changeIndices, spec.indices)) return null;

  const ix: CastleIdx = {
    kf: indexFromSquare(spec.kingFrom),
    kt: indexFromSquare(spec.kingTo),
    rf: indexFromSquare(spec.rookFrom),
    rt: indexFromSquare(spec.rookTo),
  };
  const pk = prev[ix.kf] ?? null;
  const nk = next[ix.kt] ?? null;
  if (!kingEndsOk(pk, nk)) return null;
  if (!rookEndsMatchKing(prev[ix.rf] ?? null, next[ix.rt] ?? null, pk))
    return null;
  if (!castleOriginsDestEmpty(prev, next, ix)) return null;

  return {
    from: spec.kingFrom,
    to: spec.kingTo,
    castle: { rookFrom: spec.rookFrom, rookTo: spec.rookTo },
  };
}

function inferCastleChange(
  prev: Position,
  next: Position,
  ch: CellChange[]
): Move | null {
  const idx = ch.map((c) => c.i);
  for (const spec of CASTLE_SPECS) {
    const m = tryCastleSpec(spec, prev, next, idx);
    if (m) return m;
  }
  return null;
}
